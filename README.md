[![CI](https://github.com/bdtran2002/ForkOrFry/actions/workflows/ci.yml/badge.svg)](https://github.com/bdtran2002/ForkOrFry/actions/workflows/ci.yml)
![Firefox only](https://img.shields.io/badge/firefox-MV3-orange?logo=firefoxbrowser&logoColor=white)
![Node](https://img.shields.io/badge/node-20.19%2B-339933?logo=node.js&logoColor=white)
![WXT](https://img.shields.io/badge/WXT-0.20-8b5cf6)
[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](./LICENSE)

# ForkOrFry

ForkOrFry is pivoting from a fake takeover prank extension into a local-only Firefox game extension.

## Pivot target

The new product direction is:

1. Detect inactivity.
2. When the user becomes active again via mouse activity, open a large persistent extension-owned game pane/window.
3. Launch a bundled local fork of [`hurrycurry`](https://codeberg.org/hurrycurry/hurrycurry.git) inside that surface.
4. Ship a custom version of the game that is:
   - single-player only
   - completely local
   - backed by persistent local storage
   - locked to the burger level only
5. Later replace the shipped assets with a new aesthetic pass.

## Non-negotiable constraints

- No multiplayer.
- No remote backend.
- No network dependency for gameplay.
- Persistence must stay local to the extension.
- The burger level is the only supported level in the first shipped game build.
- Asset/theme work comes later; first get the local playable loop working.

## Important Firefox UI note

Firefox action popups are not truly persistent. To match the intended "large pane popup" behavior, this pivot will use a persistent extension-owned surface such as a dedicated extension window/panel-style page rather than the small ephemeral toolbar popup.

## Current implementation plan

### Phase 1 — repoint the extension flow

- replace the current idle → fake takeover flow
- change the trigger to inactivity followed by renewed mouse activity
- keep the extension local-only

### Phase 2 — build the persistent game surface

- replace the current takeover page behavior with a persistent large extension-owned UI surface
- keep reuse/focus behavior so repeated triggers reopen the same surface instead of spawning duplicates
- preserve simple debug controls during development

### Phase 3 — bundle and adapt hurrycurry

- vendor the game locally into the extension project
- remove all multiplayer/networked behavior
- hard-lock the game to single-player burger-level play
- keep the game launchable entirely from packaged extension assets

### Phase 4 — persistence

- store progression/session data locally
- keep save/load behavior deterministic and offline
- expose reset hooks for development and QA

### Phase 5 — art direction pass

- replace borrowed placeholder assets later
- keep art swaps isolated from trigger logic and save logic

## Current codebase starting point

The existing repo still contains the pre-pivot prank/takeover implementation. The main files that will be repurposed are:

- `extension/src/core/background.ts` — idle lifecycle and trigger orchestration
- `extension/src/core/takeover.ts` — current open/reuse logic for the existing extension page
- `extension/src/core/state.ts` — `browser.storage.local` state persistence
- `extension/src/core/messages.ts` — popup/background command contract
- `extension/src/features/popup/app.ts` — current toolbar popup controls
- `extension/src/features/takeover/app.ts` — current fake takeover UI
- `extension/src/entrypoints/takeover/*` — existing extension page entrypoint that can be replaced or repurposed
- `extension/wxt.config.ts` — manifest wiring and extension surface configuration

## Project layout

- repo root: project docs and GitHub Actions
- `extension/`: the Firefox extension package
- `docs/amo/`: legacy AMO/reviewer prep docs from the pre-pivot version

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

## Near-term development checklist

- replace the old prank copy with pivot-safe game language
- implement idle → activity triggering instead of immediate idle trigger
- switch from the old takeover page flow to a persistent game surface
- bundle a local fork of `hurrycurry`
- strip multiplayer completely
- add local persistent save state
- lock the shipped game to the burger level
- leave clear seams for the later asset/theme replacement
