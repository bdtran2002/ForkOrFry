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
- popup arms/disarms the extension, clears stored state, triggers a demo, and shows live status details
- popup includes configurable idle timing presets for faster demos or slower prank pacing
- takeover page runs a staged fake onboarding sequence with progress, activity logs, and a simulated cursor
- state lives in `browser.storage.local`
- generated Firefox toolbar/extension icons are included in the build output
- no content scripts, host permissions, or network requests are used

## Current feature set

- **Arming flow:** arm, disarm, demo, and clear state directly from the popup
- **Live popup status:** mode, takeover-tab state, and last trigger timestamp are visible from the toolbar UI
- **Adjustable idle timing:** switch between preset idle intervals without editing code
- **Theatrical takeover:** fake onboarding steps, progress bar, fake activity log, and local-only completion state
- **Automated coverage:** Vitest checks core background state transitions and popup command wiring
- **Firefox packaging:** CI uploads the raw build output and a separate workflow can package an unsigned `.xpi`
- **Firefox branding assets:** generated PNG icons are wired into the Firefox MV3 manifest, including light/dark toolbar variants

## Project layout

- repo root: repository docs and GitHub Actions
- `extension/`: the actual Firefox extension package
- `docs/amo/`: reviewer notes, permissions notes, QA checklist, and AMO submission scaffolding

## Develop locally

Requires Node `^20.19.0 || >=22.12.0`.

```bash
cd extension
npm install
npm run dev
```

## Build and load in Firefox

```bash
cd extension
npm run build
```

Then load the extension in Firefox via `about:debugging` → `This Firefox` → `Load Temporary Add-on` and select:

```text
extension/dist/firefox-mv3/manifest.json
```

## Verification

```bash
cd extension
npm run lint
npm test
npm run build
```

`npm run build` is the main full verification check for the Firefox extension.

## CI

GitHub Actions runs from the repo root but builds the dedicated `extension/` package. Each CI run:

- installs dependencies from `extension/package-lock.json`
- runs `npm run lint`
- runs `npm test`
- runs `npm run build`
- uploads the built Firefox extension files from `extension/dist/firefox-mv3/` as an artifact

There is also a manual/tag packaging workflow that runs `npm run package:firefox` and uploads an unsigned `.xpi` artifact.

## Packaging

```bash
cd extension
npm run package:firefox
```

This writes:

```text
extension/dist/forkorfry-firefox-mv3.xpi
```

That package is useful for CI artifacts and debug/testing flows. Public Firefox distribution still needs signing through AMO or another Firefox signing flow.

If you want to regenerate the committed Firefox icons:

```bash
cd extension
npm run icons:generate
```

## AMO-ready repo structure

This repo now keeps Firefox Add-on submission prep in dedicated locations:

- `extension/` contains the installable extension source, tests, icons, and packaging scripts
- `docs/amo/reviewer-notes.md` explains what the extension does for future reviewer context
- `docs/amo/permissions.md` records why the current permissions are needed
- `docs/amo/qa-checklist.md` tracks the manual checks to run before submission
- `docs/amo/listing-assets/` is reserved for future screenshots, promo art, and store assets

## Notes

- Use the popup to arm/disarm or run the demo.
- The popup also shows the current mode, takeover-tab status, last trigger time, and selected idle interval.
- **Clear state** removes the stored idle timestamp and closes any open takeover tab.
- Changing the idle interval updates Firefox idle detection immediately when the extension is armed.
- Firefox toolbar icons now include theme-aware light/dark variants for better contrast.
- The takeover page is fake-only and does not control the real cursor.
- Permissions stay minimal: `idle`, `storage`, `tabs`.

## Developer TODO

- Do a focused manual Firefox QA pass on idle timing, takeover tab reuse, and dismiss/reset flows.
- Review copy/branding for AMO-safe parody language before any public submission.
