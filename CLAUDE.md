# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Story Builder is a [CODAP](https://codap.concord.org/) **data interactive plugin** that lets users author "moments" — snapshots of the full CODAP document state — and arrange them into a navigable data story. The plugin is loaded inside CODAP as an iframe and communicates with CODAP asynchronously over `iframe-phone`.

See `Architecture.md` for a deeper design discussion; the highlights are below.

## Common commands

- `npm start` — dev server on `localhost:3000` (Create React App / `react-scripts`).
- `npm run build` — production build to `build/`.
- `npm test` — Jest via `react-scripts test` (watch mode by default; pass `-- --watchAll=false` for one-shot, or `-- -t "name"` to run a single test).
- `npm run strings:pull` — pull production translations from PO Editor into `src/utilities/strings.json`. See README §Internationalization — **never edit `strings.json` by hand**; source of truth is the CODAP repo's `lang/strings/en-US.json`, pushed to PO Editor, then pulled here.
- `bin/deploy_v8` / `bin/deploy_v7` — **legacy V2-only rsync deploys** to `codap-server.concord.org:public_html` under `story_builder_v8` / `story_builder_v7`. V3 releases ship through `.github/workflows/ci.yml` on tag push (see §Versioning). Don't run these for V3 work.
- `bin/deploy_help` — rsync `help_site/` to the same server.

## Testing the plugin against CODAP

Online CODAP forces HTTPS and won't load an `http://localhost:3000` plugin. Instead, download a CODAP build zip from `https://codap.concord.org/releases/zips/`, run it locally on port 8080, then open:

```
http://127.0.0.1:8080/static/dg/en/cert/index.html?di=http://localhost:3000
```

## Toolchain quirks

- TypeScript is pinned to **3.3.3333** and React to **16.14**; `react-scripts` is **4.0.3**. The `tsconfig` targets ES5 with `strict` and `experimentalDecorators` on. Avoid syntax/library features that require newer TS (e.g. modern `Awaited`, satisfies, etc.) — they will not compile.
- `package.json` declares `"type": "module"` so the `bin/*.js` scripts run as ESM (note the `import fetch from 'node-fetch'`). Don't switch them to CommonJS.
- Service worker registration is intentionally disabled in `src/index.tsx`.

## Architecture (the parts that span files)

The split between **Models** (state + CODAP transactions) and **Pieces** (React components) is load-bearing — UI handlers in `src/pieces/*` delegate to model methods in `src/models/*` rather than mutating state directly.

**Async/CODAP communication invariant:** all CODAP I/O goes through `src/lib/CodapInterface.ts` (iframe-phone wrapper). Because messages are async, when CODAP asks the plugin for its state while the plugin is itself waiting on a CODAP-state notification, the plugin must return nothing — `StoryArea` uses flags like `waitingForDocumentState`, `restoreInProgress`, and `restoringCodapStateInProgress` to coordinate. Be careful preserving these guards when editing `story_area.ts`.

**Model layering:**
- `StoryBuilder` (`models/story_builder.ts`) — top-level init; creates the text component, positions the plugin, owns `kSBVersion`. Holds no story state.
- `StoryArea` (`models/story_area.ts`) — handles CODAP notifications, dialog state machine, and synchronization between the active Moment and the CODAP narrative text component (`kNarrativeTextBoxName`).
- `MomentsManager` (`models/moments-manager.ts`) — linked list of moments, master-data-context cache, save/restore including backward-compatibility for older plugin states. Owns the `jsondiffpatch` DiffPatcher.
- `Moment` (`models/moment.ts`) — one snapshot: `codapState` (without data contexts) + diff patches keyed by data-context ID against the master cache.

**Why the master/diff scheme exists (Architecture.md §"Differencing"):** through v0.76 each moment embedded full copies of every data context, causing file bloat. Now `MomentsManager` stores one master per data context ID; each Moment stores only a `dc_patches` diff. When saving a Moment, data contexts are stripped out of the document object and replaced with patches; when activating a Moment, patches are applied against the master and re-attached before sending to CODAP. If a diff exceeds ~2/3 of the master size, a new sub-master is stored. **Do not store full data contexts in a Moment** — round-tripping through master+patch is the contract.

**Force-update plumbing:** models hold a `forceUpdateCallback` injected from the React side so they can request re-renders after async CODAP responses. `Architecture.md` flags this as a known smell; touch it carefully, but don't rip it out without a plan to replace it.

**Component tree:** `StoryBuilderComponent` → `StoryAreaComponent` (renders moments, handles drag/drop, hosts `Dialog`) + `HelpButton` / `AutoSaveButton`. `MomentComponent` renders an individual moment with `TitleEditor`. `ControlArea` hosts the revert/save/add buttons. `EmptyMoment` is the first-moment placeholder.

## Translations

`src/utilities/translate.ts` exports `tr(stringID, ...args)`; `%@` and `%@N` are substitution tokens. Language is picked from the `?lang=` URL param, then `document.documentElement.lang`, then the browser, then `en`. All user-visible strings should go through `tr()` with IDs prefixed `DG.plugin.StoryBuilder.*` so the PO Editor pull picks them up.

## Versioning and releases

Two version sources must agree for every release: `kSBVersion` in `src/models/story_builder.ts` and `version` in `package.json`. The deploy workflow (`.github/workflows/ci.yml`) refuses to ship if either disagrees with the pushed tag.

V3 release flow:
1. Open a PR that bumps both `kSBVersion` and `package.json` `version` to `X.Y` (matching values).
2. Merge to master.
3. Push an annotated tag `vX.Y` at master HEAD (`git tag -a vX.Y -m "..." && git push origin vX.Y`).
4. The `deploy` job validates `tag == kSBVersion == package.json.version`, then syncs to `s3://codap-resources/plugins/story-builder/`, `s3://models-resources/story-builder/`, and an immutable archive at `s3://models-resources/story-builder/version/vX.Y/`.

Cache strategy: hashed assets under `build/static/` are uploaded with long-cache + immutable headers and synced **without** `--delete` (so any browser still holding cached old HTML can resolve its asset references); HTML/manifests at the root get `no-cache, no-store, must-revalidate` with `--delete`. No CloudFront invalidation is run — the per-file headers do the work. Sync ordering is archive-first, then hashed-assets-before-HTML per canonical target, so a partial failure can never leave new HTML referencing not-yet-uploaded chunks.

Auth is GitHub OIDC into IAM role `arn:aws:iam::612297603577:role/story-builder` (no long-lived secrets in the repo). See `README.md` §Releasing for the release flow and known caveats (including the one-shot Brotli-variant cache window observed during `v0.87` commissioning).
