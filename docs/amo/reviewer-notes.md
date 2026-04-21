# ForkOrFry reviewer notes

## What the extension does

ForkOrFry is a Firefox extension that hosts a local game runtime inside extension-owned pages.

Today the extension can:

- detect Firefox idle state and reopen the local game host on renewed activity
- run the current child runtime inside an extension-owned host shell
- keep the playable session local to the extension
- support both a popup-window host and a full-tab host for the same local session

## What it does not do

- no network requests
- no remote code
- no content scripts
- no host permissions
- no interaction with third-party sites
- no server dependency for the shipped direction

## Source layout

- `extension/` contains the extension source, icons, tests, and packaging scripts
- `docs/amo/` contains reviewer-facing notes, permissions rationale, and QA checklists

## Local verification

From `extension/`:

```bash
npm run lint
npm test
npm run build
```

## Source bundle

`npm run package:source-bundle` creates the AMO review bundle at `extension/dist/forkorfry-source-bundle.zip`.
