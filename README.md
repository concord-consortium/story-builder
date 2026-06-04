# Story Builder Plugin Project for Writing Data Stories 

### Initial steps

1. Clone this repo and `cd` into it
2. Run `npm install` to pull dependencies
3. Run `npm start` to run `webpack-dev-server` in development mode with hot module replacement

## Testing the plugin in CODAP

Currently there is no trivial way to load a plugin running on a local server 
with `http` into the online CODAP, which forces `https`. 
One simple solution is to download the latest `build_[...].zip` file from 
https://codap.concord.org/releases/zips/, extract it to a folder and run 
it locally. 
If CODAP is running on port 8080, and this project is running by default on 
3000, you can go to

http://127.0.0.1:8080/static/dg/en/cert/index.html?di=http://localhost:3000

to see the plugin running in CODAP.

This project was bootstrapped with 
[Create React App](https://github.com/facebook/create-react-app).

## Internationalization

This web application is designed to support internationalization, at least in
respect to the user visible strings. 
This section describes the processes involved in various circumstances. 
The strings file is stored locally in `src/utilities/strings.json`.
This file includes translations for all user visible strings in the web application
itself.
It does not include translations for help pages or localization of images.
It includes all translations.

The source for the translation strings is the CODAP project on the [Po Editor 
translation service](https://poeditor.com/projects/po_edit?id_language=189&id=125447).
In turn, the master for the US english strings is in the CODAP repository 
(`${CODAP}/lang/strings/en-US.json`).
**DO NOT make changes to `src/utilities/strings.json` directly.**
Instead, make the changes in the CODAP file.
The following sections describe the procedures for managing the strings file.

### I wish to add a new string to the codeline.
1. If it is not already so, clone the CODAP repository to a directory parallel to this one.
2. Add or modify the strings in `${CODAP}/lang/strings/en-US.json`. Be sure that any new strings have an ID that conforms to the naming convention for this plugin.
3. In this directory run `npm run strings:dev`. This will replace the strings file a file derived from the above edited file. It is English language only.
4. Test and verify the new strings.
5. In the CODAP root directory, push the strings to the PO Editor: `npm run strings:push`.
6. In this directory, pull the production strings file: `npm run strings:prod`. This will have all translated languages.
7. Commit and push the changed strings file.

### A translator has added or updated a CODAP translation
1. In this directory, run `npm run strings:prod`.
2. If any of the strings for this application have changed, the strings file will be updated. Test, commit and push the changes.

## Available Scripts

In the project directory, you can run:

### `npm start`

Runs the app in the development mode.<br>
Open [http://localhost:3000](http://localhost:3000) to view it in the browser.

The page will reload if you make edits.<br>
You will also see any lint errors in the console.

### `npm run build`

Builds the app for production to the `build` folder.<br>
It correctly bundles React in production mode and optimizes the build for the best performance.

The build is minified and the filenames include the hashes.<br>
Your app is ready to be deployed!

See the section about 
[deployment](https://facebook.github.io/create-react-app/docs/deployment) for 
more information.

## Releasing

V3 releases ship through `.github/workflows/ci.yml`. Every push and PR runs build + Jest; pushing an annotated `vX.Y` tag additionally runs the deploy job. The deploy job refuses to ship unless three version sources agree: the pushed tag, `kSBVersion` in `src/models/story_builder.ts`, and `version` in `package.json`.

To cut a release:

1. Open a PR that bumps both `kSBVersion` and `package.json` `version` to `X.Y` (matching values).
2. Merge to `master`.
3. Push an annotated tag at the new master HEAD:
   ```
   git tag -a vX.Y -m "Release X.Y notes..." && git push origin vX.Y
   ```

The deploy job validates the versions, then syncs the build artifact to three S3 locations:

| Target | Purpose |
|---|---|
| `s3://codap-resources/plugins/story-builder/` | V3 read path (served via `codap.concord.org/codap-resources/...`) |
| `s3://models-resources/story-builder/` | org-standard canonical location |
| `s3://models-resources/story-builder/version/vX.Y/` | immutable per-version archive |

**Cache strategy.** Hashed assets under `build/static/` are uploaded with `Cache-Control: public, max-age=31536000, immutable` and **without** `--delete`, so any browser still holding cached old HTML can resolve its asset references. HTML and root manifests are uploaded with `Cache-Control: no-cache, no-store, must-revalidate` **with** `--delete`. No CloudFront invalidation is performed — the per-file headers do the work.

**Recovery from a failed deploy.** Pre-AWS failures (tag mismatch, missing build, failed tests) abort with no S3 writes; fix the underlying issue and re-tag. If a sync step fails mid-deploy, re-run the failed job from the Actions UI — the `build_test` artifact is preserved, and all sync operations are idempotent (re-uploading byte-identical content is a no-op). The sync ordering (archive first, then hashed-assets-before-HTML per canonical target) guarantees that a partial failure leaves at most one canonical URL serving the previous release, never a broken state with new HTML referencing missing assets.

**Legacy V2 path.** `bin/deploy_v7` and `bin/deploy_v8` still exist and rsync to `codap-server.concord.org:public_html` for the V2 hosting environment. They are unrelated to the V3 workflow above.

### Known caveats

- **Orphaned hashed assets accumulate.** Because canonical hashed-asset syncs omit `--delete`, every release leaves the previous build's chunks in `s3://codap-resources/plugins/story-builder/static/` and `s3://models-resources/story-builder/static/`. Accumulation is slow (tens of KB per release for stable libraries); a periodic prune is future work.
- **First-deploy Brotli stale-cache window (one-shot).** The `codap.concord.org` CloudFront distribution auto-compresses text content and varies its cache key on `Accept-Encoding`. HTML uploaded before this workflow existed had no `Cache-Control`, so CloudFront cached it under the policy's 24h `DefaultTTL`. Path-based invalidations flush the uncompressed variant cleanly but do not reliably flush the Brotli-compressed variant (observed during commissioning of `v0.87`; reproduced across three invalidations including a `/codap-resources/plugins/*` wildcard). The natural resolution is to wait up to 24h from the pre-deploy cache time; a distribution-wide `/*` invalidation on `E3H9X49AG3GYSO` is the escape hatch. Cannot recur on subsequent deploys because the new `no-cache` header prevents CloudFront from caching HTML for more than 1 second.
- **`build_test` has no concurrency group.** Two tags pushed within `build_test`'s ~2-minute window can race; the older tag's deploy may overwrite the newer tag's canonical content. The trade-off favors PR-iteration speed over protecting against an unlikely cadence. Don't push tags faster than `build_test` completes.

