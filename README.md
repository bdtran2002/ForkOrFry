# ForkOrFry

[![CI](https://github.com/bdtran2002/ForkOrFry/actions/workflows/ci.yml/badge.svg)](https://github.com/bdtran2002/ForkOrFry/actions/workflows/ci.yml)
![Status](https://img.shields.io/badge/status-pivot--in--progress-8b5cf6)
![Version](https://img.shields.io/badge/version-0.0.0-blue)
![Firefox only](https://img.shields.io/badge/firefox-MV3-orange?logo=firefoxbrowser&logoColor=white)
![UI target](https://img.shields.io/badge/ui-popup%20or%20side%20panel-7c3aed)
![Godot](https://img.shields.io/badge/Godot-4.6-478cbf?logo=godotengine&logoColor=white)
![Rust](https://img.shields.io/badge/Rust-1.93.1-000000?logo=rust)
![Node](https://img.shields.io/badge/node-20.19%2B-339933?logo=node.js&logoColor=white)
![WXT](https://img.shields.io/badge/WXT-0.20-8b5cf6)
![Game mode](https://img.shields.io/badge/game-single--player%20offline-green)
[![License: AGPL-3.0-only](https://img.shields.io/badge/license-AGPL%203.0--only-green.svg)](./LICENSE)

ForkOrFry is pivoting from a fake takeover prank extension into a browser-extension-hosted local game build based on [`hurrycurry`](https://codeberg.org/hurrycurry/hurrycurry.git).

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
- `extension/src/features/takeover/app.ts` — current fake takeover UI
- `extension/src/entrypoints/takeover/*` — existing extension page entrypoint
- `extension/wxt.config.ts` — manifest/action wiring

Upstream `hurrycurry` areas that matter most:

- `client/` — Godot client
- `server/` — Rust server and simulation reference
- `test-client/` — TypeScript protocol reference
- `protocol.md` — network contract

## Licensing direction

The upstream `hurrycurry` repo is AGPL-3.0-only. Since the pivoted product is intended to vendor and modify that code locally, this repo is being prepared for AGPL-3.0-only distribution as the safest license baseline. See [`LICENSE`](./LICENSE) and [`THIRD_PARTY_NOTICES.md`](./THIRD_PARTY_NOTICES.md).

## Project layout

- repo root: project docs and GitHub Actions
- `extension/`: the Firefox extension package
- `docs/`: pivot analysis and legacy AMO/reviewer notes

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

## Near-term implementation checklist

- replace the prank/takeover flow with inactivity → renewed activity behavior
- move the runtime surface into an extension popup/pane-style game UI
- vendor `hurrycurry` locally
- remove live networking and server dependence
- replace remote players with local bots
- add local persistence and fast resume behavior
- lock the first shipped build to the burger level
- keep art/theme swaps isolated for a later pass
