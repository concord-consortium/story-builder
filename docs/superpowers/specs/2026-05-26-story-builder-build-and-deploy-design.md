# Story Builder: standalone build & deploy design

**Date:** 2026-05-26
**Jira:** [CODAP-1366](https://concord-consortium.atlassian.net/browse/CODAP-1366)
**Status:** Approved design; ready for implementation plan

## Problem

Until now, story-builder has been deployed to production as part of the CODAP v2 build pipeline (`/codap-v2-build` skill in the codap repo), which assembles seven repositories on a developer's workstation and pushes to `codap-server.concord.org`. CODAP v3 reads plugins from a separate S3 bucket (`codap-resources`) that is currently populated by a *manual* rsync from the v2 build's `extn/plugins/` directory — managed by the `/codap-resources` skill. Both paths are heavy, manual, and bottlenecked on the v2 release cadence.

With the v3 release approaching, we need to be able to build and deploy story-builder (and eventually other standalone plugins) independently of the v2 build process. The first immediate use case is shipping the CODAP-1362 fix (PR #2) without waiting for the next v2 build.

## Scope

In scope:
- A GitHub Actions workflow in `concord-consortium/story-builder` that builds and deploys to S3 on tag push.
- Dual-bucket publish during the v2→v3 transition: both `models-resources/story-builder/` (org-standard layout) and `codap-resources/plugins/story-builder/` (the bucket v3 currently reads from).
- Standard CI (build + Jest tests) on every push and PR.

Out of scope:
- Migration of other plugins to this pattern (intentionally not generalized — copy-paste the workflow when a second plugin needs it).
- Retiring `bin/deploy_v7` and `bin/deploy_v8` (legacy V2 endpoints; decide later).
- Refactoring `kSBVersion` to derive from `package.json` (deferred).
- Modernizing the toolchain enough to drop `--openssl-legacy-provider` (separate concern).
- Branch / preview deploys (deferred; recipe noted under "Future work").

## Decisions

| Decision | Choice |
|---|---|
| Deploy targets | Both `s3://models-resources/story-builder/` and `s3://codap-resources/plugins/story-builder/` |
| `models-resources` layout | Tag → root + `version/<tag>/` archive |
| `codap-resources` layout | Tag → root only (overwrite in place) |
| Trigger | GitHub Actions on tag push matching `v[0-9]*` (tighter than `v*` so stray non-version tags like `vibe-check` don't fire deploy) |
| Versioning | Developer bumps `kSBVersion` *and* `package.json` `version` in a PR; tag matches; workflow validates all three agree |
| CI scope | Build + Jest test on every push/PR; deploy job gated by tag |
| Workflow file | Single `.github/workflows/ci.yml` (org convention) |
| Sync mechanism | Plain `aws s3 sync --delete` (no `--size-only`) — correct in CI because build mtimes are always fresh |
| CloudFront invalidation | Not used. Cache strategy below makes invalidation unnecessary. |
| Concurrency | `concurrency: { group: story-builder-deploy, cancel-in-progress: false }` on the deploy job to serialize tag races |
| AWS authentication | GitHub OIDC → IAM role assumption via `aws-actions/configure-aws-credentials@v4`. No long-lived secrets. Role: `arn:aws:iam::612297603577:role/story-builder`, set up via `concord-consortium/starter-projects/scripts/create-deploy-role.sh`. |
| IAM policy | Shared managed policy `S3-deploy-by-role-tag` (covers `models-resources/story-builder/*` via RepoName tag) + supplemental inline policy for `codap-resources/plugins/story-builder/*` writes. No CloudFront permission needed — see Cache strategy. |
| Cache strategy | Per-file `Cache-Control` headers set at upload time. Hashed assets (`build/static/*`): `public, max-age=31536000, immutable`. HTML and root manifests: `no-cache, no-store, must-revalidate`. No `aws cloudfront create-invalidation` step — CloudFront honors origin `Cache-Control` (verified: both distributions use cache policy `S3-CORS-1` with MinTTL=1, so `no-cache` is respected). |
| Generalization to other plugins | None for now — copy-paste when needed |

## Workflow architecture

A single GitHub Actions workflow at `.github/workflows/ci.yml` with two jobs.

```yaml
on:
  push:
    branches: [master]
    tags: ['v[0-9]*']
  pull_request:

jobs:
  build_test:           # always runs
  deploy:               # gated by tag; needs build_test
    if: startsWith(github.ref, 'refs/tags/v')
    needs: build_test
    concurrency:
      group: story-builder-deploy
      cancel-in-progress: false
```

`build_test` runs on every push to `master`, every PR, and every tag push. It primes the artifact that `deploy` consumes — `deploy` does not rebuild, so deployed bits are byte-identical to what passed tests.

The `branches: [master]` filter on push avoids double-running CI when a feature-branch push opens a PR (the PR event covers branch CI).

## Release flow

The repo's PR convention drives the version-bump cadence:

1. Open a version-bump PR that updates both:
   - `src/models/story_builder.ts` → `kSBVersion = '0.87'`
   - `package.json` → `"version": "0.87"`
2. Review and merge to `master`.
3. Tag the merge commit: `git tag v0.87 && git push --tags`.

Tag format is `v<semver>` (e.g., `v0.87`), matching the workflow's `'v[0-9]*'` tag filter and the `v` prefix convention common in the org.

The workflow validates and never writes back to the repo. Forgetting to bump shows up as a failed CI run — recoverable by a small follow-up PR, then a fresh tag.

The above is the steady-state flow. **For the first release**, the package.json version makes a single jump from its long-stale `0.1.0` straight to the new version (e.g., `0.87`) as part of the bump PR — there is no intermediate alignment to `0.86`. This is deliberate: the mismatched state on master (immediately after the workflow-introducing PR merges, but before the first bump PR) is exactly the state that lets Stage 1 of commissioning prove the validation step works. See **Testing / commissioning strategy** below.

## Workflow step-by-step

### `build_test` job

```yaml
runs-on: ubuntu-latest
steps:
  - uses: actions/checkout@v4
  - uses: actions/setup-node@v4
    with:
      node-version: '18'
      cache: 'npm'
  - run: npm ci
  - run: CI=true npm test -- --watchAll=false
    env: { NODE_OPTIONS: --openssl-legacy-provider }
  - run: npm run build
    env: { NODE_OPTIONS: --openssl-legacy-provider }
  - uses: actions/upload-artifact@v4
    with:
      name: build
      path: build/
      if-no-files-found: error
```

Notes:
- `--openssl-legacy-provider` is required because react-scripts 4.0.3 / webpack 4 use OpenSSL APIs removed in Node 17+. Same flag the V2 codap CI uses.
- `CI=true` plus `--watchAll=false` makes `react-scripts test` exit instead of starting watch mode.
- Single Node version (18). No matrix — overkill for this repo.
- `actions/setup-node@v4`'s `cache: 'npm'` keys on `package-lock.json` and avoids re-downloading dependencies on every run.

### `deploy` job

```yaml
needs: build_test
if: startsWith(github.ref, 'refs/tags/v')
runs-on: ubuntu-latest
timeout-minutes: 15
permissions:
  id-token: write                # required for OIDC token issuance
  contents: read
  actions: read                  # required for download-artifact@v4 under restricted permissions
concurrency:
  group: story-builder-deploy
  cancel-in-progress: false
env:
  TAG: ${{ github.ref_name }}    # e.g., "v0.87"
steps:
  - uses: actions/checkout@v4                        # need source for validation step
  - uses: actions/download-artifact@v4
    with: { name: build, path: build }

  - name: Validate tag matches kSBVersion and package.json
    run: |
      TAG_VERSION="${TAG#v}"
      SB_VERSION=$(sed -nE "s/.*kSBVersion = \"([^\"]+)\".*/\1/p" src/models/story_builder.ts | head -1)
      PKG_VERSION=$(node -p "require('./package.json').version")
      if [[ -z "$SB_VERSION" || -z "$PKG_VERSION" || "$TAG_VERSION" != "$SB_VERSION" || "$TAG_VERSION" != "$PKG_VERSION" ]]; then
        echo "Mismatch or empty: tag=$TAG_VERSION kSBVersion=$SB_VERSION package.json=$PKG_VERSION"
        exit 1
      fi

  - name: Sanity-check build artifact
    run: |
      if [[ ! -s build/index.html ]]; then
        echo "build/index.html missing or empty — refusing to sync"
        exit 1
      fi

  - uses: aws-actions/configure-aws-credentials@v4
    with:
      role-to-assume: arn:aws:iam::612297603577:role/story-builder
      aws-region: us-east-1

  # Archive first so canonical URLs are never updated without a matching archive.
  - name: Archive to models-resources/version/<tag>/
    run: |
      aws s3 sync build/ s3://models-resources/story-builder/version/${TAG}/ --delete \
        --cache-control "public, max-age=31536000, immutable"

  # Canonical syncs — two-step per target: hashed assets first (additive,
  # long-cache), then HTML/manifests (with --delete, no-cache).

  - name: Sync hashed assets to codap-resources
    run: |
      aws s3 sync build/static/ s3://codap-resources/plugins/story-builder/static/ \
        --cache-control "public, max-age=31536000, immutable"
  - name: Sync HTML/manifests to codap-resources
    run: |
      aws s3 sync build/ s3://codap-resources/plugins/story-builder/ --delete \
        --exclude "static/*" \
        --cache-control "no-cache, no-store, must-revalidate"

  - name: Sync hashed assets to models-resources root
    run: |
      aws s3 sync build/static/ s3://models-resources/story-builder/static/ \
        --cache-control "public, max-age=31536000, immutable"
  - name: Sync HTML/manifests to models-resources root
    run: |
      aws s3 sync build/ s3://models-resources/story-builder/ --delete \
        --exclude "static/*" --exclude "version/*" \
        --cache-control "no-cache, no-store, must-revalidate"
```

Flag rationale:
- **No `--size-only` anywhere.** In CI, build artifacts always have fresh mtimes (newer than any prior S3 LastModified), so plain `aws s3 sync` uploads everything that has changed by mtime — which, in CI, is effectively the whole build. Cost: a few MB of bandwidth per release. Benefit: avoids the documented bug where `--size-only` misses content changes that happen to preserve file size (e.g., `index.html` with a swapped hashed-asset reference).
- **`--delete` on the archive and on the HTML/manifest syncs.** The archive sync uses `--delete` so a force-pushed tag re-deploy doesn't leave orphan files in the version-pinned path. The HTML/manifest sync uses `--delete --exclude "static/*"` so removed root-level files (HTML, manifests) are purged without touching the hashed-asset subtree.
- **Hashed-asset syncs intentionally omit `--delete`.** Old hashed assets linger to support cached old HTML that may still reference them. Filenames change with content, so accumulation is incremental and slow; periodic pruning is future work (see Known limitations).
- **`--exclude "version/*"`** on the models-resources root sync so the version archive isn't wiped. (No `--exclude "branch/*"` — we don't deploy branches.)
- **`--cache-control` per sync.** Hashed assets and immutable archives use `public, max-age=31536000, immutable`. HTML and root manifests use `no-cache, no-store, must-revalidate`. Both CloudFront distributions use cache policy `S3-CORS-1` (MinTTL=1, DefaultTTL=86400, MaxTTL=31536000), so origin `Cache-Control` is fully respected at the edge. Browser caches also respect these headers, eliminating the failure mode where a cached old HTML references a deleted hashed asset.
- **No `aws cloudfront create-invalidation`.** Because origin `Cache-Control` is respected, new HTML is served immediately (no-cache) and new hashed assets are referenced by new HTML (immutable + content-addressed). Invalidations are redundant and only affect CloudFront — they would NOT clear browser caches, which the cache-control headers do address.
- **No `--acl public-read`.** Both buckets have bucket policies that grant `s3:GetObject` to `Principal: *` on all objects, so per-object ACLs are redundant. Dropping the flag also makes the workflow robust against future moves to `BucketOwnerEnforced` ownership (AWS's recommended default for new buckets, which disables per-object ACLs and would cause `--acl public-read` to fail at PUT time).

Step order: **write the version archive first**, then per canonical target sync hashed assets (additive, long-cache) then HTML/manifests (`--delete`, no-cache). Archive-first means the canonical URLs are never updated without a corresponding archive existing — a partial failure between archive and canonical leaves the version archive present but the canonical still serving the previous release, which is a recoverable state. Within each canonical target, hashed-assets-first means new asset filenames exist before new HTML references them, eliminating any window where new HTML would point at not-yet-uploaded assets.

### Defensive flags

- **`if-no-files-found: error`** on `actions/upload-artifact@v4`. Default is `warn`, which would silently produce an empty artifact if `build/` were ever missing or empty; combined with `aws s3 sync --delete` on the download, that would wipe production. Setting `error` makes the upload step fail loudly instead.
- **`Sanity-check build artifact` step** before any AWS call. Checks `test -s build/index.html`. Belt-and-suspenders for the same failure mode — if the artifact contents are intact at upload time but somehow truncated or partially-extracted on download, the sync is blocked before it can do damage.
- **Validation step also fails on empty `kSBVersion` or `package.json` version.** A renamed file or moved constant would produce empty strings; without the empty-check, two empty strings would `==` and validation would pass spuriously. The `head -1` pipe on `sed` also defends against multiple matches (e.g., a stale `// kSBVersion = "0.85"` comment).
- **`timeout-minutes: 15`** on the deploy job. Default GHA job timeout is 6 hours; a hung AWS call could otherwise burn that whole budget. 15 minutes is well above a normal deploy's runtime (~2 minutes typical).
- **`actions: read`** on the deploy job's `permissions:` block. Required by `actions/download-artifact@v4` under restricted permissions (any explicit `permissions:` block sets unlisted scopes to `none`, including the `actions` scope the download API uses).
- **Tag filter `'v[0-9]*'`** (not `'v*'`). Restricts the deploy trigger to tags that look like version markers (`v0.86`, `v1.0.0`, etc.), so stray `v`-prefixed tags like `vibe-check` don't fire the job at all. Validation is still the authoritative check for matching versions, but the tighter glob is a defense-in-depth layer.

### Known limitations (accepted, not fixed)

- **No concurrency group on `build_test`.** Two tags pushed close together create two independent `build_test` runs in parallel; whichever finishes first enters the `deploy` queue first. In the pathological case where `build_test` ordering inverts the push order, the older tag's deploy runs second and overwrites the newer tag's canonical content. Mitigation: don't push tags faster than `build_test` completes (~2 minutes). Adding concurrency to `build_test` would also serialize PR builds against tag deploys, hurting iteration; the trade-off doesn't favor protecting against a corner case that's unlikely under normal release cadence.
- **Trigger duplication on tagged releases.** Pushing a commit to master AND pushing a release tag at that commit fires two parallel `build_test` runs (one for `push:master`, one for `push:tags`). CI cost only; no correctness impact.
- **Orphaned hashed assets in `static/`.** Canonical hashed-asset syncs intentionally omit `--delete` so cached old HTML can still reference old assets without 404ing. Over many releases this accumulates orphans in `s3://codap-resources/plugins/story-builder/static/` and `s3://models-resources/story-builder/static/`. The accumulation is slow (~tens of KB per release for unchanged libraries, more for libraries that change), and S3 storage is cheap. A periodic prune job (e.g., delete files older than N days) is future work.

## Error handling

### Pre-write failures (cheap to recover; no deploy side effects)

| Failure | Where | Recovery |
|---|---|---|
| `npm ci` fails | `build_test` | Fix lockfile/dependency, re-push tag or re-run from UI |
| Jest tests fail | `build_test` | Fix tests or code; new PR; re-tag |
| `npm run build` fails | `build_test` | Fix; re-tag |
| Tag mismatch with `kSBVersion` / `package.json` | `deploy` validation step | Open a fix-up PR aligning the versions, merge, delete and re-push the tag (or push a new one) |

The validation step runs before any AWS call, so a mismatch fails loud with zero deploy side effects.

### Partial-deploy failures

The S3 sync steps run sequentially: archive → codap-resources static → codap-resources HTML → models-resources static → models-resources HTML. If a later step fails, earlier writes have already happened. The archive-first ordering ensures the immutable version snapshot exists before any canonical URL is updated. Within each canonical target, hashed-asset-first ordering ensures new asset filenames exist before new HTML references them. A partial failure between targets leaves one canonical URL serving the new release and the other still serving the previous release — a recoverable state, not a broken one.

Recovery: re-run the failed job from the Actions UI. The artifact from `build_test` is preserved, so the re-run uses byte-identical bits. All sync operations are idempotent — re-uploading the same content with the same `Cache-Control` is a no-op. No new commit, no new tag.

### Tag-race protection

The `concurrency: { group: story-builder-deploy }` block serializes deploy runs. If two tags land in quick succession, the second waits for the first to finish before starting. Build jobs still run in parallel — only the deploy is serialized. Without this, two parallel deploys could race at the S3 layer and leave the older tag's artifact serving from root.

### Explicitly not handled

- **Re-tagging the same version** (force-pushing `v0.87` to a different commit): workflow re-runs and re-deploys. Loses audit trail; accepted trade-off for simplicity. Tag-protection rules are out of scope.
- **Inline retries within a single sync step**: AWS CLI already retries individual operations. Re-running the job is the right escape hatch.

## Testing / commissioning strategy

The workflow is the deliverable; "testing" means commissioning safely. The repo's own state gives us two natural test cases — no test tags needed.

### What `build_test` already covers

Every push to a feature branch and every PR runs the build/test job, exercising:
- `npm ci` correctness.
- The existing Jest smoke test (`src/story_builder.test.tsx` — asserts the component renders without crashing).
- `npm run build` produces an artifact (catches TS / webpack failures).

So as soon as the PR that introduces `ci.yml` opens, the CI half is iteratively exercised without any AWS involvement.

### Stage 1 — natural-state failure proves the validation step

After the introducing PR merges, master is in a known mismatched state: `kSBVersion = '0.86'` and `package.json` version = `'0.1.0'`. Push `v0.86` as a tag at master HEAD. The deploy job runs; validation compares `tag → 0.86` against `kSBVersion → 0.86` (match) and `package.json → 0.1.0` (**mismatch**), and exits non-zero before any AWS call. We see the expected failure and confirm the validator does its job. No S3 writes, no tag namespace pollution beyond the `v0.86` tag itself (a legitimate marker for the current production code).

### Stage 2 — version-bump PR proves end-to-end success

Open a small follow-up PR that aligns both versions to `0.87` (also includes the CODAP-1362 fix already on master from PR #2). Merge. Tag `v0.87` at the new HEAD. The full deploy job runs:

- Validation passes (`tag → 0.87`, `kSBVersion → 0.87`, `package.json → 0.87` all match).
- All five S3 syncs execute against production (archive + two canonicals × two sync steps each).
- Verify by `aws s3 ls` against each prefix, by checking `Cache-Control` headers on a sample of objects (`aws s3api head-object`), and by loading the new build in a CODAP V3 instance and confirming the CODAP-1362 fix is live.

Stage 2 is also the real first ship of the bugfix, so commissioning and shipping are one act. If anything in Stage 2 fails (AWS creds, IAM, CloudFront perms), the fix is to address that underlying issue and re-run the workflow from the Actions UI.

### Not tested in this design

- Workflow YAML syntax beyond what GitHub validates on push (`actionlint` is overkill for ~80 lines of workflow).
- CloudFront edge propagation (operational expectation; new `Cache-Control: no-cache` HTML reaches all edges within ~seconds, much faster than a manual invalidation would have).
- Cross-version regressions on the V2 side (manual functional check during commissioning).

## Prerequisites

### Verify before the first deploy (blocking)

1. **AWS authentication via OIDC.** No long-lived secrets — story-builder follows the org's current pattern: GitHub OIDC → IAM role assumption. **Setup steps**, run by someone with IAM admin in account `612297603577`:
   - **a.** From a checkout of `concord-consortium/starter-projects` (or this repo, since the script is self-contained), run `./scripts/create-deploy-role.sh story-builder`. This creates IAM role `story-builder`, tags it `RepoName=story-builder`, sets a trust policy that limits assumption to workflows in `concord-consortium/story-builder`, and attaches the shared managed policy `S3-deploy-by-role-tag` (which covers `s3://models-resources/story-builder/*` via the `RepoName` tag).
   - **b.** Attach a supplemental inline policy to the same role covering the things the shared policy doesn't:
     - `s3:PutObject`, `s3:DeleteObject` on `arn:aws:s3:::codap-resources/plugins/story-builder/*`
     - `s3:ListBucket` on `arn:aws:s3:::codap-resources` with condition `s3:prefix` like `plugins/story-builder/*` (needed for `aws s3 sync` to list the prefix)
   - **c.** Verify by inspecting the new role: `aws iam get-role --role-name story-builder` and `aws iam list-attached-role-policies --role-name story-builder`.

   No GitHub repo secrets are required — the workflow uses `aws-actions/configure-aws-credentials@v4` with `role-to-assume` and the OIDC `id-token` permission. `build_test` runs without any AWS involvement.

2. **Bucket public-read access.** ✅ **Confirmed 2026-05-26:** both `codap-resources` and `models-resources` have bucket policies that grant `s3:GetObject` to `Principal: *`, so all uploaded objects are publicly readable by default. No `--acl public-read` flag is needed on the AWS CLI commands.
3. **GitHub Actions enabled** on the story-builder repo (default for org repos; verify the setting is on).

### Values resolved

- **CloudFront distribution ID for `models-resources`.** `E1QHTGVGYD1DWZ` (serves `models-resources.concord.org` and `resources.models.concord.org`). Resolved 2026-05-26.
- **CloudFront serving URL for `models-resources/story-builder/`.** `https://models-resources.concord.org/story-builder/` (assuming the standard generic-distribution path layout used by other plugins in that bucket). Not used by V3 today but useful for any eventual migration.

## Future work (explicitly out of this design)

1. **Branch deploys + S3 lifecycle TTL.** Recipe is settled — drop `--size-only` (already done here), add a bucket lifecycle rule on `*/branch/*` with an N-day expiration so unmaintained branch dirs age out automatically. Add when a real preview-build need arises.
2. **Extend pattern to other standard plugins** (codap-transformers, noaa-codap-plugin already have similar workflows; importer/sampler/scrambler in `codap-data-interactives` are still bundled via the V2 build). When a third plugin needs the same dual-bucket pattern, that's a natural moment to extract a reusable workflow.
3. **Decide fate of `bin/deploy_v7` and `bin/deploy_v8`.** Out of scope here; revisit when the legacy V2 endpoints they target stop serving traffic.
4. **Pick one bucket as canonical; drop the other.** The dual-bucket setup is transitional. At some point we evaluate trade-offs (org convention vs. existing V3 read path vs. whatever pattern emerges) and pick one. Whichever isn't chosen gets dropped from this workflow, and any consumers of the dropped location are updated.
5. **Make `package.json` the version source of truth.** Refactor `src/models/story_builder.ts` to import the version from `package.json` so validation only checks one place. Deferred.
6. **Drop `--openssl-legacy-provider`.** Disappears whenever story-builder modernizes its build toolchain.

## Coordination with existing skills

- **`/codap-v2-build`** continues to bundle story-builder via `makeExtn` for V2 releases — no change. The new workflow is an *additional* deploy path for V3, not a replacement.
- **`/codap-resources`** continues to be the right tool for one-off manual syncs (emergency hotfixes outside CI, or syncing other plugins still on the manual path). Once V3 migrates off `codap-resources/plugins/story-builder/` (Future-work item 4), the skill's "Syncing from V2 Build" section becomes story-builder-irrelevant but stays useful for other plugins.
