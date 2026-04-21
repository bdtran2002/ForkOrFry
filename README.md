# ForkOrFry

[![CI](https://github.com/bdtran2002/ForkOrFry/actions/workflows/ci.yml/badge.svg)](https://github.com/bdtran2002/ForkOrFry/actions/workflows/ci.yml)
[![PR Preview](https://github.com/bdtran2002/ForkOrFry/actions/workflows/pr-preview.yml/badge.svg)](https://github.com/bdtran2002/ForkOrFry/actions/workflows/pr-preview.yml)
[![Package Firefox](https://github.com/bdtran2002/ForkOrFry/actions/workflows/package-firefox.yml/badge.svg)](https://github.com/bdtran2002/ForkOrFry/actions/workflows/package-firefox.yml)
![Pivot](https://img.shields.io/badge/pivot-extension--game--shell-8b5cf6)
![Status](https://img.shields.io/badge/status-in%20progress-f59e0b)
![Mode](https://img.shields.io/badge/mode-single--player%20local-green)
![Target](https://img.shields.io/badge/target-Firefox%20MV3-orange?logo=firefoxbrowser&logoColor=white)
![UI](https://img.shields.io/badge/ui-popup%20%2F%20side%20panel-7c3aed)
![Runtime](https://img.shields.io/badge/runtime-extension%20owned-blue)
![Godot](https://img.shields.io/badge/Godot-4.x-478cbf?logo=godotengine&logoColor=white)
![Rust](https://img.shields.io/badge/Rust-reference%20only-000000?logo=rust)
![Node](https://img.shields.io/badge/node-20.19%2B-339933?logo=node.js&logoColor=white)
![WXT](https://img.shields.io/badge/WXT-0.20-8b5cf6)
[![License: AGPL-3.0-only](https://img.shields.io/badge/license-AGPL%203.0--only-green.svg)](./LICENSE)

ForkOrFry is pivoting from a fake takeover prank extension into a browser-extension-hosted local game shell based on [`hurrycurry`](https://codeberg.org/hurrycurry/hurrycurry.git).

This repo is currently in the “extension game shell” phase: the end goal is a single-player, fully local game running inside an extension-owned UI surface. Godot integration is **not done yet**.

## Current implementation status

- ✅ Firefox extension scaffolding exists
- ✅ WXT-based build/dev/packaging scripts exist
- ✅ CI runs lint, tests, and build for the extension
- ✅ Firefox packaging workflow exists
- ✅ Idle → renewed-activity shell trigger is implemented in the extension background flow
- ✅ Extension-owned reusable large popup shell window is implemented as the current runtime surface
- ✅ Local checkpoint/resume placeholder state exists for shell window lifecycle resets
- ⏳ Local hurrycurry client integration is still to be implemented
- ⏳ Multiplayer/server removal is still in progress as a repo pivot
- ⏳ Bot players, production save/resume, and burger-level locking are still to be implemented
- ⏳ Godot WebAssembly embed is still future work

## Roadmap / TODO

### Completed

- [x] Define the single-player local-only direction
- [x] Keep the browser extension as the runtime container
- [x] Add CI and Firefox packaging workflows
- [x] Preserve the extension repo as the implementation home
- [x] Replace prank/takeover behavior with inactivity → renewed activity flow
- [x] Move runtime UI into a reusable popup-window shell

### In progress

- [ ] Vendor or otherwise localize the `hurrycurry` client build
- [ ] Remove runtime dependency on any game server
- [ ] Convert game state to local authoritative ownership
- [ ] Turn the current shell checkpoint placeholder into production local persistence and fast resume

### Pending

- [ ] Implement rule-based bots to replace remote players
- [ ] Lock the shipped experience to burger level only
- [ ] Add save/load checkpointing for constrained extension lifecycle
- [ ] Prepare the Godot WebAssembly export path
- [ ] Separate asset/theme swaps from core gameplay logic

## Objective

Convert the project into:

- single player only
- no server dependency
- bots replacing all remote players
- a browser-hosted lightweight extension application running inside a popup or side-panel-style container

The final runtime must live inside a browser extension UI context, not a full-tab application.

## Hard constraints

- Do not use Docker.
- Do not build or deploy the Rust server.
- Do not preserve multiplayer networking as a runtime feature.
- Treat server code as reference only.
- The client must fully own game state.
- Target environment:
  - Godot WebAssembly export
  - embedded inside a browser extension popup or side-panel-style UI
  - compatible with constrained viewport sizing and frequent open/close lifecycle events

## Product rules

- Trigger on inactivity first, then on renewed mouse activity.
- Open the game inside an extension-owned popup/pane surface rather than a full browser tab.
- Bundle a local fork of `hurrycurry` directly in the extension repo.
- Ship a single-player-only build.
- Keep gameplay completely local and offline.
- Persist save/progress locally.
- Lock the first shipped experience to the burger level only.
- Leave asset/theme replacement for a later phase.

## Repository layout

- `extension/` — Firefox extension app, WXT config, scripts, tests
- `.github/workflows/` — CI and Firefox packaging workflows
- `docs/` — pivot analysis and supporting notes
- `README.md` — project direction, developer guide, and roadmap
- `LICENSE` / `THIRD_PARTY_NOTICES.md` — licensing and attribution for the hurrycurry pivot

Upstream `hurrycurry` is currently a reference target documented in `docs/pivot-analysis.md`; it is not vendored into this repo yet.

## Workflow / CI overview

- `ci.yml` runs on pull requests plus pushes to `main` / `release/**`
  - installs dependencies
  - runs lint
  - runs tests
  - runs the Firefox build
  - uploads the built extension directory as an artifact
- `pr-preview.yml` runs on pull requests and manual dispatch
  - installs dependencies
  - runs lint, tests, and the Firefox package build
  - builds the review/source bundle
  - validates the packaged artifacts
  - uploads preview XPI and source-bundle artifacts for reviewers
- `package-firefox.yml` runs on tag push or manual dispatch
  - installs dependencies
  - resolves the Firefox add-on ID
  - runs lint and tests
  - packages release artifacts
  - uploads the unsigned XPI and source bundle

## Developer setup

### Requirements

- Node.js `^20.19.0 || >=22.12.0`
- npm
- `zip` / `unzip` available on your PATH for packaging + validation scripts
- Python 3 if you need to regenerate extension icons
- Firefox desktop browser for temporary loading and manual verification

### Install

```bash
cd extension
npm install
```

### Dev mode

```bash
cd extension
npm run dev
```

### Preview mode

```bash
cd extension
npm run preview
```

### Build

```bash
cd extension
npm run build
```

### Test

```bash
cd extension
npm test
```

Watch mode:

```bash
cd extension
npm run test:watch
```

### Lint

```bash
cd extension
npm run lint
```

Auto-fix where safe:

```bash
cd extension
npm run lint:fix
```

### Packaging

Firefox XPI package:

```bash
cd extension
npm run package:firefox
```

Source bundle:

```bash
cd extension
npm run package:source-bundle
```

Release artifact bundle:

```bash
cd extension
npm run package:release
```

If you are packaging artifacts intended to match a published Firefox add-on ID, set `FORKORFRY_GECKO_ID` before running the release workflow/scripts.

Validate release artifacts:

```bash
cd extension
npm run validate:release-artifacts
```

### Temporary loading in Firefox

1. Run `npm run build` in `extension/`
2. Open Firefox and go to `about:debugging#/runtime/this-firefox`
3. Click **Load Temporary Add-on**
4. Select `extension/dist/firefox-mv3/manifest.json`

### Manual smoke test for the current shell

1. Load the temporary add-on in Firefox.
2. Open the toolbar popup and click **Arm idle trigger**.
3. Let Firefox enter the configured idle state.
4. Return to activity and verify the extension opens or refocuses the large shell window.
5. Use **Open pane now** to test the shell directly.
6. Close and reopen the shell to verify the placeholder checkpoint/resume status is preserved.

### Release / package commands

- `npm run package:firefox` — local unsigned XPI for manual installs
- `npm run package:source-bundle` — source archive for release/review workflows
- `npm run package:release` — full release artifact build
- `npm run validate:release-artifacts` — checks packaged outputs

### Command reference

| Command | Purpose |
| --- | --- |
| `npm run dev` | Run the WXT Firefox development loop |
| `npm run preview` | Serve a preview build locally |
| `npm run lint` | Run ESLint across the extension code |
| `npm test` | Run the Vitest suite |
| `npm run build` | Produce the Firefox MV3 extension bundle |
| `npm run package:firefox` | Build and zip an unsigned Firefox XPI |
| `npm run package:source-bundle` | Create the source archive used for review/release |
| `npm run package:release` | Build release artifacts end-to-end |
| `npm run validate:release-artifacts` | Verify packaged outputs and metadata |
| `npm run icons:generate` | Regenerate the extension icon assets |

## Firefox UI reality

Firefox action popups are ephemeral. The shipped UX still needs to feel like an extension popup/pane application, so the implementation should prefer a side-panel-style or similarly extension-owned constrained UI surface, with popup lifecycle-safe pause/resume behavior when persistence is needed.

## Phase plan

### Phase 1 — repository analysis

Produce:

- architecture breakdown for client, server, and protocol
- network flow mapping
- dependency graph
- list of networking entry points
- list of gameplay systems dependent on server state
- identification of gameplay/network coupling points

Phase 1 output lives in [`docs/pivot-analysis.md`](./docs/pivot-analysis.md).

### Phase 2 — transformation design

Design a migration that:

- removes server authority completely
- converts the client into a self-contained simulation
- replaces multiplayer synchronization with local state management
- accounts for browser extension popup/side-panel lifecycle limits

### Phase 3 — networking removal

Implement or stage:

- full disablement of server connections
- removal or stubbing of networking layers
- replacement of remote game state with local authoritative state

### Phase 4 — bot system

Implement bot players to replace all remote players.

Bots must:

- behave like real players through the input/command system
- support movement
- support object interaction
- participate in the cooking loop
- start with rule-based logic
- remain extensible for smarter future AI

### Phase 5 — browser + extension compatibility

Prepare for:

- Godot WebAssembly export
- embedding inside a browser extension popup or side panel
- fixed or resizable small viewports
- rapid open/close lifecycle events
- deterministic startup from scratch when needed
- lightweight initialization with no native dependencies

## Current codebase starting point

Current extension files that will be repurposed:

- `extension/src/core/background.ts` — idle lifecycle and trigger orchestration
- `extension/src/core/takeover.ts` — current extension-page open/reuse logic
- `extension/src/core/state.ts` — `browser.storage.local` state persistence
- `extension/src/core/messages.ts` — popup/background command contract
- `extension/src/features/popup/app.ts` — current toolbar popup controls
- `extension/src/features/runtime-host/*` — current extension-owned host shell and runtime boundary
- `extension/src/features/runtime-frame/*` — current demo child runtime adapter behind that boundary
- `extension/src/entrypoints/takeover/*` — existing extension page entrypoint
- `extension/wxt.config.ts` — manifest/action wiring

Upstream `hurrycurry` areas that matter most:

- `client/` — Godot client
- `server/` — Rust server and simulation reference
- `test-client/` — TypeScript protocol reference
- `protocol.md` — network contract

## Licensing direction

The upstream `hurrycurry` repo is AGPL-3.0-only. Since the pivoted product is intended to vendor and modify that code locally, this repo is being prepared for AGPL-3.0-only distribution as the safest license baseline. See [`LICENSE`](./LICENSE) and [`THIRD_PARTY_NOTICES.md`](./THIRD_PARTY_NOTICES.md).

## Contributor guidance

- Keep changes aligned with the single-player, local-only, extension-hosted direction.
- Do not reintroduce multiplayer or server runtime dependencies.
- Prefer incremental changes that preserve the current extension shell while the game layer is being added.
- Keep browser lifecycle, persistence, and constrained viewport behavior in mind for every UI change.
- Update this README when the pivot status changes materially.

## Near-term implementation checklist

- replace the prank/takeover flow with inactivity → renewed activity behavior
- move the runtime surface into an extension popup/pane-style game UI
- vendor `hurrycurry` locally
- remove live networking and server dependence
- replace remote players with local bots
- add local persistence and fast resume behavior
- lock the first shipped build to the burger level
- keep art/theme swaps isolated for a later pass
