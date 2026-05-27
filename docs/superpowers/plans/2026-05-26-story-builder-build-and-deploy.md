# Story Builder Build & Deploy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a GitHub Actions workflow to `concord-consortium/story-builder` that builds + tests on every push/PR and deploys to two S3 buckets + invalidates CloudFront on `v*` tag push. First live ship is the CODAP-1362 fix.

**Architecture:** Single workflow file (`.github/workflows/ci.yml`) with two jobs. `build_test` (always) runs `npm ci` + Jest + `npm run build` and uploads `build/` as an artifact. `deploy` (tag-only, `needs: build_test`) downloads the artifact, validates that tag + `kSBVersion` + `package.json` version all agree, then `aws s3 sync`s to `codap-resources/plugins/story-builder/`, `models-resources/story-builder/`, and `models-resources/story-builder/version/<tag>/`, and finally creates CloudFront invalidations on both distributions. Concurrency group on `deploy` serializes tag races.

**Tech Stack:** GitHub Actions, AWS CLI v2 (`aws s3 sync`, `aws cloudfront create-invalidation`), Node 18 (with `--openssl-legacy-provider` for react-scripts 4 / webpack 4 compatibility), Jest via `react-scripts test`.

**Reference:** [Design spec](../specs/2026-05-26-story-builder-build-and-deploy-design.md). **Jira:** [CODAP-1366](https://concord-consortium.atlassian.net/browse/CODAP-1366). Working branch: `CODAP-1366-build-deploy`.

---

## File Structure

| Action | File | Responsibility |
|---|---|---|
| Create | `.github/workflows/ci.yml` | Two-job CI/CD workflow (build_test + deploy) |
| Modify (Stage 2 PR, separate from this branch) | `src/models/story_builder.ts` | Bump `kSBVersion` from `'0.86'` to `'0.87'` |
| Modify (Stage 2 PR) | `package.json` | Bump `"version"` from `"0.1.0"` to `"0.87"` |

The workflow file is the only code artifact on the `CODAP-1366-build-deploy` branch. The version bumps live on a separate Stage 2 PR (`CODAP-1366-release-0.87` branch, created in Task 5) so that Stage 1 commissioning (Task 4) can verify the validation step catches the natural mismatched state on master.

No source-code changes outside these three files.

---

## Task 1: Verify AWS prerequisites

**Purpose:** Confirm the workflow can authenticate and act before we hard-code IDs into the YAML.

**Files:** none (this task only gathers values; nothing is committed).

- [ ] **Step 1: Confirm `concord-consortium/story-builder` has org-level AWS secrets inherited**

Visit `https://github.com/concord-consortium/story-builder/settings/secrets/actions` in the browser. Expected: `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` appear in the "Organization secrets" section (inherited, not repository-overridden). If they don't, ask repo admin / org admin to grant the story-builder repo access to the existing org secrets.

- [ ] **Step 2: Confirm IAM permissions for those creds**

Run from a shell where the same AWS creds are configured (or have an AWS admin run):

```bash
aws sts get-caller-identity   # confirm which IAM principal you're testing
aws iam simulate-principal-policy \
  --policy-source-arn <PRINCIPAL_ARN> \
  --action-names s3:PutObject s3:DeleteObject s3:ListBucket \
  --resource-arns \
      arn:aws:s3:::codap-resources/plugins/story-builder/* \
      arn:aws:s3:::models-resources/story-builder/*
aws iam simulate-principal-policy \
  --policy-source-arn <PRINCIPAL_ARN> \
  --action-names cloudfront:CreateInvalidation \
  --resource-arns \
      arn:aws:cloudfront::*:distribution/E1RS9TZVZBEEEC
```

Expected: every action returns `EvalDecision: allowed`. If any return `implicitDeny` or `explicitDeny`, request an IAM policy update before continuing.

- [ ] **Step 3: Confirm bucket ACL configuration permits `--acl public-read`**

```bash
aws s3api get-bucket-ownership-controls --bucket codap-resources \
  --query 'OwnershipControls.Rules[0].ObjectOwnership' --output text
aws s3api get-bucket-ownership-controls --bucket models-resources \
  --query 'OwnershipControls.Rules[0].ObjectOwnership' --output text
```

Expected: either `BucketOwnerPreferred` or `ObjectWriter`. If either returns `BucketOwnerEnforced`, ACLs are disabled and the spec's contingency applies — revisit the design before writing the workflow (either re-enable ACLs on that bucket or drop `--acl public-read` from the workflow and rely on bucket-policy-based public access).

- [ ] **Step 4: Look up the CloudFront distribution ID for `models-resources`**

```bash
aws cloudfront list-distributions \
  --query 'DistributionList.Items[?contains(Aliases.Items[0], `models-resources`) || contains(Origins.Items[0].DomainName, `models-resources.s3`)].{Id:Id,Aliases:Aliases.Items,Origin:Origins.Items[0].DomainName}' \
  --output table
```

Expected: a single row with the distribution ID. Record the ID — you'll paste it into the workflow file in Task 2 Step 3. If you find more than one matching distribution, pick the one whose alias is `models-resources.concord.org` (or ask whoever maintains the org's AWS infra).

- [ ] **Step 5: Record findings**

Write the discovered `<MODELS_RESOURCES_DIST_ID>` value and the IAM principal name in a scratch note (e.g., on the CODAP-1366 Jira issue). You'll reference the distribution ID in Task 2. The IAM principal is for documentation / future debugging only.

If any of Steps 1–3 fails, **stop** and resolve the underlying issue before proceeding to Task 2. Don't write the workflow against an environment that can't run it.

---

## Task 2: Write the `ci.yml` workflow file

**Files:**
- Create: `.github/workflows/ci.yml`

This task assumes Task 1 succeeded and you have the `models-resources` distribution ID handy.

- [ ] **Step 1: Confirm you're on the `CODAP-1366-build-deploy` branch**

Run:

```bash
git rev-parse --abbrev-ref HEAD
```

Expected: `CODAP-1366-build-deploy`. If not, switch:

```bash
git checkout CODAP-1366-build-deploy
```

- [ ] **Step 2: Create the workflows directory**

Run:

```bash
mkdir -p .github/workflows
```

Expected: no output (directory either already exists or is created). Confirm:

```bash
ls -la .github/workflows/
```

Expected: empty directory (the repo has no existing workflows — confirmed during exploration).

- [ ] **Step 3: Write `.github/workflows/ci.yml`**

Substitute the `<MODELS_RESOURCES_DIST_ID>` placeholder near the bottom with the real distribution ID you recorded in Task 1 Step 4. Everything else is literal.

```yaml
name: Continuous Integration

on:
  push:
    branches: [master]
    tags: ['v*']
  pull_request:

jobs:
  build_test:
    name: Build & Test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'
      - name: Install dependencies
        run: npm ci
      - name: Run Jest tests
        run: CI=true npm test -- --watchAll=false
        env:
          NODE_OPTIONS: --openssl-legacy-provider
      - name: Build
        run: npm run build
        env:
          NODE_OPTIONS: --openssl-legacy-provider
      - name: Upload build artifact
        uses: actions/upload-artifact@v4
        with:
          name: build
          path: build/

  deploy:
    name: Deploy to S3
    needs: build_test
    if: startsWith(github.ref, 'refs/tags/v')
    runs-on: ubuntu-latest
    concurrency:
      group: story-builder-deploy
      cancel-in-progress: false
    env:
      AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
      AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
      AWS_DEFAULT_REGION: us-east-1
      TAG: ${{ github.ref_name }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/download-artifact@v4
        with:
          name: build
          path: build

      - name: Validate tag matches kSBVersion and package.json
        run: |
          TAG_VERSION="${TAG#v}"
          SB_VERSION=$(sed -nE 's/.*kSBVersion = "([^"]+)".*/\1/p' src/models/story_builder.ts)
          PKG_VERSION=$(node -p "require('./package.json').version")
          echo "tag=$TAG_VERSION kSBVersion=$SB_VERSION package.json=$PKG_VERSION"
          if [[ "$TAG_VERSION" != "$SB_VERSION" || "$TAG_VERSION" != "$PKG_VERSION" ]]; then
            echo "::error::Version mismatch — refusing to deploy."
            exit 1
          fi

      - name: Sync to codap-resources (V3 read path)
        run: |
          aws s3 sync build/ s3://codap-resources/plugins/story-builder/ \
            --acl public-read --delete

      - name: Sync to models-resources root (canonical)
        run: |
          aws s3 sync build/ s3://models-resources/story-builder/ \
            --acl public-read --delete \
            --exclude "version/*"

      - name: Archive to models-resources/version/<tag>/
        run: |
          aws s3 sync build/ s3://models-resources/story-builder/version/${TAG}/ \
            --acl public-read

      - name: Invalidate CloudFront (codap-resources)
        run: |
          aws cloudfront create-invalidation \
            --distribution-id E1RS9TZVZBEEEC \
            --paths "/plugins/story-builder/*"

      - name: Invalidate CloudFront (models-resources)
        run: |
          aws cloudfront create-invalidation \
            --distribution-id <MODELS_RESOURCES_DIST_ID> \
            --paths "/story-builder/*"
```

- [ ] **Step 4: Sanity-check the YAML parses**

Run:

```bash
python3 -c "import yaml,sys; yaml.safe_load(open('.github/workflows/ci.yml')); print('YAML OK')"
```

Expected: `YAML OK`. If you get a YAMLError, re-check indentation (workflows are sensitive to tabs vs. spaces — the file above uses 2-space indentation throughout).

- [ ] **Step 5: Verify the placeholder was replaced**

Run:

```bash
grep -n "MODELS_RESOURCES_DIST_ID" .github/workflows/ci.yml
```

Expected: **no output**. If grep finds the placeholder string, you forgot to substitute it in Step 3.

- [ ] **Step 6: Verify locally that the validation step's bash logic is correct against the *current* mismatched state**

Run the same logic the workflow will run, in your shell, against the working tree (which still has the mismatched versions):

```bash
TAG_VERSION="0.86"   # simulating a v0.86 tag
SB_VERSION=$(sed -nE 's/.*kSBVersion = "([^"]+)".*/\1/p' src/models/story_builder.ts)
PKG_VERSION=$(node -p "require('./package.json').version")
echo "tag=$TAG_VERSION kSBVersion=$SB_VERSION package.json=$PKG_VERSION"
```

Expected output:

```
tag=0.86 kSBVersion=0.86 package.json=0.1.0
```

This confirms the sed and node lookups work against the real files. The mismatch (`0.86 != 0.1.0`) is the failure mode Stage 1 will exercise.

- [ ] **Step 7: Commit the workflow**

```bash
git add .github/workflows/ci.yml
git commit -m "$(cat <<'EOF'
CODAP-1366: add ci.yml for build + S3 deploy on tag

Build & test on every push to master and every PR. Deploy job
(tag-only, v*) downloads the build_test artifact, validates that
kSBVersion + package.json version + tag all agree, then syncs to
codap-resources/plugins/story-builder/ and to models-resources/
story-builder/ (root + version/<tag>/ archive), and creates
CloudFront invalidations on both distributions.

See docs/superpowers/specs/2026-05-26-story-builder-build-and-deploy-design.md
for the full design rationale.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

Verify:

```bash
git log --oneline -3
```

Expected: top commit is `CODAP-1366: add ci.yml for build + S3 deploy on tag`, second commit is `CODAP-1366: design doc for standalone build & deploy` (e1edd75), third is the master HEAD that includes the CODAP-1362 fix.

---

## Task 3: Push the branch and open the PR

**Files:** none.

- [ ] **Step 1: Push the branch to origin**

```bash
git push -u origin CODAP-1366-build-deploy
```

Expected: the push succeeds and prints the upstream-tracking message.

- [ ] **Step 2: Open the PR**

```bash
gh pr create \
  --base master \
  --title "CODAP-1366: standalone build & deploy workflow" \
  --body "$(cat <<'EOF'
## Summary
- Adds `.github/workflows/ci.yml`: build + Jest test on every push/PR; deploys to S3 + CloudFront on `v*` tag push.
- Adds the design spec at `docs/superpowers/specs/2026-05-26-story-builder-build-and-deploy-design.md` covering rationale, decisions, and commissioning plan.
- Dual-bucket publish during the V2→V3 transition: `codap-resources/plugins/story-builder/` (current V3 read path) and `models-resources/story-builder/` (org standard + per-tag archive).

## Test plan
- [ ] Verify `build_test` job runs green on the PR push (CI builds and Jest test passes).
- [ ] After merge, push `v0.86` tag at master HEAD. Confirm the deploy job's **validation step fails** (master has `kSBVersion = '0.86'` but `package.json` version is still `'0.1.0'`), with no S3 writes.
- [ ] In follow-up PR, bump `kSBVersion` and `package.json` to `0.87`; tag `v0.87`. Confirm the full deploy succeeds end-to-end and the CODAP-1362 fix is live in V3.

Refs CODAP-1366.
EOF
)"
```

Expected: the command prints the PR URL.

- [ ] **Step 3: Verify `build_test` runs and passes on the PR**

```bash
gh pr checks  # run in the repo, shows checks for the PR you just opened
```

Wait for the `Build & Test` job to complete (typically 2–4 minutes). Expected: all checks pass (✓). If `build_test` fails, investigate the logs via `gh run view --log-failed` — common causes: stale lockfile, network issue installing dependencies, a real test failure surfaced by running in CI for the first time. Resolve before requesting review.

- [ ] **Step 4: Request review**

The reviewer should look at both the design spec (for design alignment) and the workflow file (for correctness). The PR body's test plan captures what the reviewer can expect to happen post-merge.

- [ ] **Step 5: After approval, merge**

Squash-merge via the GitHub UI (matches the repo's existing PR style — the CODAP-1362 fix was squash-merged as commit `49acc8b`).

After merging, **stop and proceed to Task 4** in the same context window or session — do not delete the local branch yet; you'll want it for reference.

---

## Task 4: Stage 1 commissioning — verify validation catches mismatch

**Purpose:** Prove that the validation step fails loudly when versions don't match. Master now has `ci.yml`, `kSBVersion = '0.86'`, and `package.json` version `'0.1.0'` — the natural mismatched state from the spec.

**Files:** none (this task only pushes a tag and observes).

- [ ] **Step 1: Switch to master and pull the merged PR**

```bash
git checkout master
git pull --ff-only
```

Expected: master fast-forwards to include the merge commit from Task 3.

- [ ] **Step 2: Confirm the mismatched state is what you expect**

```bash
grep "kSBVersion" src/models/story_builder.ts
node -p "require('./package.json').version"
```

Expected:

```
export const kSBVersion = "0.86";
0.1.0
```

If `package.json` is anything other than `0.1.0`, someone has already aligned it — abort Stage 1 commissioning (the natural mismatch is gone and this test is no longer meaningful). Note that in the Jira issue and move on to Task 5.

- [ ] **Step 3: Tag `v0.86` at master HEAD and push**

```bash
git tag v0.86
git push origin v0.86
```

Expected: the tag push triggers a workflow run. Find it:

```bash
gh run list --workflow=ci.yml --limit 3
```

The most recent run should show `tag` as its event (or `push` with a `refs/tags/v0.86` ref). Wait ~30 seconds for the job to be scheduled if it doesn't appear immediately.

- [ ] **Step 4: Watch the workflow run and confirm validation fails**

```bash
gh run watch  # picks up the most recent run; or pass the run ID
```

Expected:
- `Build & Test` job succeeds (the source compiles and the test passes; nothing is wrong with the code at this commit).
- `Deploy to S3` job runs the validation step, prints `tag=0.86 kSBVersion=0.86 package.json=0.1.0`, then the `::error::Version mismatch — refusing to deploy.` annotation, and exits non-zero.
- **No subsequent S3 sync or CloudFront step runs** (because validation failed).

- [ ] **Step 5: Verify nothing was written to S3**

```bash
aws s3 ls s3://codap-resources/plugins/story-builder/ --recursive | head -5
aws s3 ls s3://models-resources/story-builder/ --recursive | head -5 2>&1 || echo "(no objects yet — expected)"
```

Expected: `codap-resources/plugins/story-builder/` shows the existing V2-rsync'd content (last-modified timestamps from the most recent V2 build, *not* from the last few minutes). `models-resources/story-builder/` may not exist yet (nothing was deployed there before) and that's fine.

- [ ] **Step 6: Confirm the tag is a legitimate marker for the current production code**

Leave the `v0.86` tag in place — it correctly marks the current `kSBVersion = '0.86'` commit on master. It is not deleted as part of Stage 1.

- [ ] **Step 7: Record the Stage 1 result**

Note in the CODAP-1366 Jira issue: "Stage 1 commissioning complete. `v0.86` tag pushed; deploy job's validation step fired as expected, exited non-zero, no S3 writes." Link to the failed workflow run URL.

If Stage 1 didn't fail as expected (e.g., validation step passed unexpectedly, or sync steps ran), **stop**. The validation logic has a bug. Fix it in a follow-up PR before proceeding to Task 5.

---

## Task 5: Stage 2 PR — bump versions to `0.87`

**Files:**
- Modify: `src/models/story_builder.ts:6`
- Modify: `package.json:3`

This PR ships the CODAP-1362 fix (already on master) as version `0.87`.

- [ ] **Step 1: Branch off master**

```bash
git checkout master   # should already be here from Task 4
git pull --ff-only    # sanity
git checkout -b CODAP-1366-release-0.87
```

- [ ] **Step 2: Bump `kSBVersion`**

Edit `src/models/story_builder.ts` line 6:

Find:
```typescript
export const kSBVersion = "0.86";
```

Replace with:
```typescript
export const kSBVersion = "0.87";
```

Verify:

```bash
grep "kSBVersion" src/models/story_builder.ts
```

Expected: `export const kSBVersion = "0.87";`

- [ ] **Step 3: Bump `package.json` version**

Edit `package.json` line 3 (the `"version"` field at the top of the file).

Find:
```json
  "version": "0.1.0",
```

Replace with:
```json
  "version": "0.87",
```

Verify:

```bash
node -p "require('./package.json').version"
```

Expected: `0.87`

- [ ] **Step 4: Sanity-check the build still works locally**

```bash
NODE_OPTIONS=--openssl-legacy-provider npm test -- --watchAll=false
NODE_OPTIONS=--openssl-legacy-provider npm run build
```

Expected: tests pass; build completes; `build/` directory populated. If build fails for an unrelated reason (e.g., toolchain quirk in your env), abort and investigate before pushing.

- [ ] **Step 5: Commit**

```bash
git add src/models/story_builder.ts package.json
git commit -m "$(cat <<'EOF'
CODAP-1366: release version 0.87

Bump kSBVersion to 0.87 and align package.json (long-stale at
0.1.0) to the same value. This is the first release that ships
through the new ci.yml deploy workflow and the first release that
includes the CODAP-1362 fix (PR #2, merged 49acc8b).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 6: Push and open the PR**

```bash
git push -u origin CODAP-1366-release-0.87
gh pr create \
  --base master \
  --title "CODAP-1366: release version 0.87" \
  --body "$(cat <<'EOF'
## Summary
- Bumps `kSBVersion` from `0.86` to `0.87` and aligns `package.json` `version` (long-stale at `0.1.0`) to `0.87`.
- First release through the new `ci.yml` deploy workflow (introduced in CODAP-1366).
- First release that includes the CODAP-1362 fix (PR #2).

## Test plan
- [ ] CI build + test passes on this PR.
- [ ] After merge, tag `v0.87` at the new HEAD. Confirm the deploy job validates successfully, syncs to both buckets + the `version/v0.87/` archive, and creates both CloudFront invalidations.
- [ ] Confirm CODAP V3 picks up the new build (CODAP-1362 fix verifiable: adding Story Builder to a v3 doc, then a graph, dirties the moment).

Refs CODAP-1366.
EOF
)"
```

- [ ] **Step 7: Verify `build_test` passes on the PR**

```bash
gh pr checks
```

Expected: `Build & Test` ✓. If it fails, investigate before requesting review.

- [ ] **Step 8: Request review and squash-merge once approved**

After merging, continue to Task 6 to push the tag.

---

## Task 6: Stage 2 commissioning — live deploy of `v0.87`

**Purpose:** Push the `v0.87` tag, watch the full deploy run, verify the artifacts land in S3 and CloudFront is invalidated.

**Files:** none.

- [ ] **Step 1: Switch to master and pull the merged release PR**

```bash
git checkout master
git pull --ff-only
```

Expected: master fast-forwards to include the `0.87` bump commit.

- [ ] **Step 2: Confirm versions are aligned**

```bash
grep "kSBVersion" src/models/story_builder.ts
node -p "require('./package.json').version"
```

Expected:

```
export const kSBVersion = "0.87";
0.87
```

- [ ] **Step 3: Tag `v0.87` and push**

```bash
git tag v0.87
git push origin v0.87
```

- [ ] **Step 4: Watch the workflow run end-to-end**

```bash
gh run list --workflow=ci.yml --limit 3
gh run watch
```

Expected sequence (~3–5 minutes total):
1. `Build & Test` job: succeeds (artifact uploaded).
2. `Deploy to S3` job validation step: prints `tag=0.87 kSBVersion=0.87 package.json=0.87`, no error.
3. `Sync to codap-resources` step: completes, lists uploaded files.
4. `Sync to models-resources root` step: completes.
5. `Archive to models-resources/version/<tag>/` step: completes.
6. `Invalidate CloudFront (codap-resources)` step: completes; prints an invalidation ID.
7. `Invalidate CloudFront (models-resources)` step: completes; prints an invalidation ID.

If any step fails, the spec's Error Handling section applies — re-run the failed job from the Actions UI (`gh run rerun <run-id> --failed`).

- [ ] **Step 5: Verify S3 contents at all three target prefixes**

```bash
aws s3 ls s3://codap-resources/plugins/story-builder/ --recursive | head -20
aws s3 ls s3://models-resources/story-builder/ --recursive | head -20
aws s3 ls s3://models-resources/story-builder/version/v0.87/ --recursive | head -20
```

Expected: all three list builds with recent LastModified timestamps (within the last few minutes). The contents should match `build/` from a local `npm run build` — at a minimum, `index.html`, `asset-manifest.json`, `static/js/main.*.js`, `static/css/main.*.css`.

- [ ] **Step 6: Verify both CloudFront invalidations completed**

```bash
aws cloudfront list-invalidations --distribution-id E1RS9TZVZBEEEC --max-items 3
aws cloudfront list-invalidations --distribution-id <MODELS_RESOURCES_DIST_ID> --max-items 3
```

Expected: the most recent invalidation on each distribution has `Status: Completed` (or `InProgress` if you check within a minute). Note the IDs — they'll typically match what step 4 printed.

- [ ] **Step 7: Smoke-test in CODAP V3 (functional verification)**

Open a CODAP V3 instance (typically `https://codap3.concord.org/` or your local v3 dev server pointing at production resources). Add Story Builder to a new document. Confirm:

1. Story Builder loads (no 404, no script errors in the console — the plugin URL resolves to the freshly synced `codap-resources/plugins/story-builder/` content).
2. The CODAP-1362 fix is present: with Story Builder added, add a graph; the first moment turns yellow (dirty). This is the user-visible bug fix this whole release is shipping.

If Story Builder loads but the CODAP-1362 fix isn't present, the most likely cause is CloudFront serving stale cached HTML. Wait 1–2 minutes for invalidation to propagate, then hard-refresh. If it persists, manually invalidate again via `aws cloudfront create-invalidation --distribution-id E1RS9TZVZBEEEC --paths "/plugins/story-builder/*"`.

- [ ] **Step 8: Record Stage 2 result**

Note in the CODAP-1366 Jira issue: "Stage 2 commissioning complete. `v0.87` tag pushed; full deploy succeeded; CODAP-1362 fix verified live in V3." Link to the successful workflow run URL and the relevant CloudFront invalidation IDs.

Also update CODAP-1362's Jira issue to "Deployed" (or your team's equivalent status) and note that the fix is live as of `v0.87`.

---

## Task 7: Close out and clean up

**Files:** none.

- [ ] **Step 1: Delete the local branches you no longer need**

```bash
git branch -d CODAP-1366-build-deploy
git branch -d CODAP-1366-release-0.87
```

Expected: branches delete cleanly (both have been merged to master).

- [ ] **Step 2: Confirm `gh pr list` shows both PRs as merged**

```bash
gh pr list --state merged --limit 5
```

Expected: both `CODAP-1366: standalone build & deploy workflow` and `CODAP-1366: release version 0.87` appear in the merged-recently list.

- [ ] **Step 3: Move the Jira issue to Done**

In the CODAP-1366 Jira UI, transition the story to `Done` (or your team's equivalent terminal status). Include a brief summary comment: "Workflow shipped (PR #N). v0.87 deployed via the new pipeline; CODAP-1362 fix live."

- [ ] **Step 4: Update the README to mention the new release process**

`README.md` currently describes the dev/test setup but doesn't mention how releases ship. Worth a small follow-up PR to document the version-bump-and-tag flow — but **defer this to a separate task**; not in scope for CODAP-1366. Add an issue or a TODO if your team tracks docs work separately.

---

## Verification summary

If everything above succeeded, the following observable end-state is true:

- `.github/workflows/ci.yml` exists on master.
- `kSBVersion = "0.87"` in `src/models/story_builder.ts`; `package.json` `version` is `"0.87"`.
- Tags `v0.86` (Stage 1 marker) and `v0.87` (live release) both exist on origin.
- The GitHub Actions run for `v0.87` shows all seven deploy-job steps as green.
- `s3://codap-resources/plugins/story-builder/`, `s3://models-resources/story-builder/`, and `s3://models-resources/story-builder/version/v0.87/` all contain the new build.
- CODAP V3, loaded fresh, exhibits the CODAP-1362 fix.

The next time someone wants to ship story-builder, the steady-state flow is just: bump kSBVersion + package.json in a PR, merge, tag `v<version>`, push tag.
