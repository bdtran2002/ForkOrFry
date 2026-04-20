# ForkOrFry

[![CI](https://github.com/bdtran2002/ForkOrFry/actions/workflows/ci.yml/badge.svg)](https://github.com/bdtran2002/ForkOrFry/actions/workflows/ci.yml)
![Firefox only](https://img.shields.io/badge/firefox-MV3-orange?logo=firefoxbrowser&logoColor=white)
![Node](https://img.shields.io/badge/node-20.19%2B-339933?logo=node.js&logoColor=white)
![WXT](https://img.shields.io/badge/WXT-0.20-8b5cf6)
[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](./LICENSE)

Firefox-only idle-triggered parody extension that opens a local takeover page when the browser goes idle.

## What it is

ForkOrFry is a local-only Firefox Manifest V3 extension built with WXT:

- background service worker watches `browser.idle`
- popup arms/disarms the extension, clears stored state, or triggers a demo
- takeover page runs the fake scripted parody sequence with a simulated cursor
- state lives in `browser.storage.local`
- no content scripts, host permissions, or network requests are used

## Project layout

- repo root: docs and GitHub Actions
- `ForkOrFry/`: the actual frontend Firefox extension app

## Develop locally

Requires Node `^20.19.0 || >=22.12.0`.

```bash
cd ForkOrFry
npm install
npm run dev
```

## Build and load in Firefox

```bash
cd ForkOrFry
npm run build
```

Then load the extension in Firefox via `about:debugging` → `This Firefox` → `Load Temporary Add-on` and select:

```text
ForkOrFry/dist/firefox-mv3/manifest.json
```

## Verification

```bash
cd ForkOrFry
npm run lint
npm run build
```

`npm run build` is the main full verification check for the Firefox extension.

## CI

GitHub Actions runs from the repo root but builds the nested extension app. Each CI run:

- installs dependencies from `ForkOrFry/package-lock.json`
- runs `npm run lint`
- runs `npm run build`
- uploads the built Firefox extension files from `ForkOrFry/dist/firefox-mv3/` as an artifact

## Notes

- Use the popup to arm/disarm or run the demo.
- **Clear state** removes the stored idle timestamp and closes any open takeover tab.
- The takeover page is fake-only and does not control the real cursor.
- Permissions stay minimal: `idle`, `storage`, `tabs`.

## Developer TODO

- Add richer fake application steps, more fields, and slightly more theatrical takeover pacing.
- Add real extension icons/assets for the popup and Firefox toolbar.
- Add automated tests around background state changes and popup command behavior.
- Do a focused manual Firefox QA pass on idle timing, takeover tab reuse, and dismiss/reset flows.
- Review copy/branding for AMO-safe parody language before any public submission.
