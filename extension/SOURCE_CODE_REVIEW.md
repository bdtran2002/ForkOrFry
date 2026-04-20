# Source code review

This bundle is intended for AMO reviewer rebuild checks.

## Rebuild instructions

1. Extract the source bundle.
2. `cd extension`
3. `npm ci`
4. `npm run lint`
5. `npm test`
6. `npm run build`
7. Confirm the Firefox package output at `dist/firefox-mv3/`.
8. For release builds, set `FORKORFRY_GECKO_ID` before packaging so the manifest carries the published Gecko ID.

## Packaging commands

- `npm run package:firefox` creates `dist/forkorfry-firefox-mv3.xpi`
- `npm run package:source-bundle` creates `dist/forkorfry-source-bundle.zip`
- `npm run package:release` creates both release artifacts in one pass

## Contents

The bundle includes the extension source, build/config scripts, root project docs, and `docs/amo/` reviewer notes.

It intentionally excludes build output, `.wxt/`, and `node_modules/`.
