# ForkOrFry

[![CI](https://github.com/bdtran2002/ForkOrFry/actions/workflows/ci.yml/badge.svg)](https://github.com/bdtran2002/ForkOrFry/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](./LICENSE)

Firefox-only idle-triggered parody extension that opens a local takeover page when the browser goes idle.

## What it is

ForkOrFry is a local-only Firefox extension built with WXT:

- background service worker watches `browser.idle`
- popup arms/disarms, clears stored state, or triggers a demo
- takeover page runs the fake scripted parody sequence with a simulated cursor
- state lives in `browser.storage.local`
- no content scripts, host permissions, or network requests are used

## Run locally

The frontend app lives in the nested `ForkOrFry/` folder.

Requires Node `^20.19.0 || >=22.12.0`.

```bash
cd ForkOrFry
npm install
npm run dev
```

Then load the extension in Firefox via `about:debugging` → `This Firefox` → `Load Temporary Add-on` and pick the built `manifest.json` from `ForkOrFry/dist/firefox-mv3/`.

## Verification

```bash
cd ForkOrFry
npm run lint
npm run build
```

`npm run build` remains the main full verification check.

## Build

```bash
cd ForkOrFry
npm run build
```

## Notes

- Use the extension popup to arm/disarm or run the demo.
- **Clear state** removes the stored idle timestamp and closes any open takeover tab.
- The takeover page is fake-only and does not control the real cursor.
- No content scripts, no host permissions, no network calls.

## Developer TODO

- Add richer fake application steps, more fields, and slightly more theatrical takeover pacing.
- Add real extension icons/assets for the popup and Firefox toolbar.
- Add automated tests around background state changes and popup command behavior.
- Do a focused manual Firefox QA pass on idle timing, takeover tab reuse, and dismiss/reset flows.
- Review copy/branding for AMO-safe parody language before any public submission.
