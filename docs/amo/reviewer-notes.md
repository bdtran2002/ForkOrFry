# ForkOrFry reviewer notes

## What the extension does

ForkOrFry is a Firefox-only local parody extension. When armed, Firefox idle detection can open a local takeover page that runs a fake onboarding sequence.

## What it does not do

- no network requests
- no remote code
- no content scripts
- no host permissions
- no real form submission
- no interaction with third-party sites

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
