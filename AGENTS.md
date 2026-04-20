# AGENTS.md

## Workspace
- The actual app lives in `ForkOrFry/`. The repo root mainly holds docs, git metadata, and GitHub workflow files, so run app commands from `ForkOrFry/`.
- Use `npm` here (`ForkOrFry/package-lock.json` is the only lockfile). There is no workspace/monorepo toolchain.
- Vite 8 requires Node `^20.19.0 || >=22.12.0`; older Node versions will fail before app code runs.

## Commands
- Install: `cd ForkOrFry && npm install`
- Dev server: `cd ForkOrFry && npm run dev`
- Main verification: `cd ForkOrFry && npm run build`
- Preview production build: `cd ForkOrFry && npm run preview`
- Lint: `cd ForkOrFry && npm run lint`
- Auto-fix lint issues: `cd ForkOrFry && npm run lint:fix`
- `npm run build` remains the main full check because it runs `tsc && vite build`.

## Architecture
- This is a plain TypeScript + Vite SPA, not React/Vue/Svelte.
- Entry path: `ForkOrFry/index.html` → `ForkOrFry/src/main.ts`.
- `ForkOrFry/src/main.ts` owns nearly everything: template markup injection, DOM lookups, state transitions, timers, persistence, and event listeners.
- `ForkOrFry/src/style.css` contains all styling; there is no CSS framework or preprocessor.
- If you change IDs/classes in the `app.innerHTML` template, keep the `els` lookup object and `render()` updates in sync in the same file.

## Behavior gotchas
- The app state machine is `intro -> active -> warning -> predicting -> result`.
- Idle timing is hard-coded in `ForkOrFry/src/main.ts`: `WARNING_MS = 4500`, `PREDICTING_MS = 8000`, `RESULT_MS = 11200`. If you change timing, also update any copy/progress text that references those thresholds.
- State persists in `localStorage` under `forkorfry:future-session:v1`. Reloads resume the current session, so clear/reset that key when manual testing seems stuck.
- Global `window` listeners treat `pointerdown`, `keydown`, `touchstart`, `scroll`, and `focus` as activity. The guard only ignores elements inside `<button>`; if you add other controls, expand `isControlTarget()` or those interactions will keep resetting the idle timer.
- `Fast-forward demo` is not a separate mock path: it arms a real session and backdates `lastActivityAt` so the normal result flow runs.

## Verification
- Manual behavior check: click `Start scrolling`, then stop interacting to watch `warning` → `predicting` → `result`.
- For a quick result-state check, use `Fast-forward demo`.
- TypeScript uses `noUnusedLocals`, `noUnusedParameters`, and `noEmit`; unused code/params will fail `npm run build`.

## Workflow
- GitHub Actions CI lives in `.github/workflows/ci.yml` and runs lint plus build from the nested app folder.
- User workflow preference: direct work on `main` is acceptable when a task explicitly includes pushing; do not assume a PR-only flow.
