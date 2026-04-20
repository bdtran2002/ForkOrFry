# AGENTS.md

## Workspace
- The actual app lives in `ForkOrFry/`. The repo root mainly holds docs, git metadata, and GitHub workflow files, so run app commands from `ForkOrFry/`.
- Use `npm` here (`ForkOrFry/package-lock.json` is the only lockfile). There is no workspace/monorepo toolchain.
- WXT expects modern Node `^20.19.0 || >=22.12.0`; older Node versions will fail before app code runs.

## Commands
- Install: `cd ForkOrFry && npm install`
- Dev flow: `cd ForkOrFry && npm run dev`
- Main verification: `cd ForkOrFry && npm run build`
- Preview production build: `cd ForkOrFry && npm run preview`
- Lint: `cd ForkOrFry && npm run lint`
- Auto-fix lint issues: `cd ForkOrFry && npm run lint:fix`
- `npm run build` is the main full check because it builds the Firefox extension.

## Architecture
- This is a Firefox-only WXT extension, not a webpage app.
- Entry points live under `ForkOrFry/src/entrypoints/` for background, popup, and takeover pages.
- Shared logic lives in `ForkOrFry/src/`; state uses `browser.storage.local`.
- `ForkOrFry/src/style.css` contains the local styling; there is no CSS framework or preprocessor.

## Behavior gotchas
- Idle detection uses `browser.idle` with a coarse interval.
- The background worker opens/focuses a singleton takeover tab at `browser.runtime.getURL('takeover.html')`.
- No content scripts or host permissions should be added.
- Keep permissions minimal: `idle`, `storage`, `tabs`.

## Verification
- Manual behavior check: open the popup, click **Arm**, then wait for Firefox idle to open the takeover tab.
- For a quick takeover check, click **Demo now** in the popup.
- TypeScript uses `noUnusedLocals`, `noUnusedParameters`, and `noEmit`; unused code/params will fail `npm run build`.

## Workflow
- GitHub Actions CI lives in `.github/workflows/ci.yml` and runs lint plus build from the nested app folder.
- To load locally in Firefox: `about:debugging` → `This Firefox` → `Load Temporary Add-on` → choose `ForkOrFry/dist/firefox-mv3/manifest.json` after building.
- User workflow preference: direct work on `main` is acceptable when a task explicitly includes pushing; do not assume a PR-only flow.
