# ForkOrFry agent plan

## Objective

Convert this repo into:

- single player only
- no server dependency
- bots replacing all remote players
- a browser-hosted lightweight extension application running inside a popup or side-panel-style container

The final product must run inside a browser extension UI context, not as a full-tab application.

## Hard constraints

- Do not use Docker.
- Do not build or deploy the Rust server.
- Do not preserve multiplayer networking as a runtime feature.
- Treat server code as reference only.
- The client must fully own game state.
- Target environment is:
  - Godot WebAssembly export
  - embedded inside a browser extension popup or side-panel-style UI
  - compatible with constrained viewport sizing and frequent popup/panel lifecycle resets

## Product rules

- Trigger on inactivity first, then on renewed mouse activity.
- The visible runtime surface must be extension-owned and constrained like a popup or side panel.
- Do not treat a full browser tab as the final shipped runtime surface.
- The shipped game is a bundled local fork of `hurrycurry`.
- The shipped build must be single-player only.
- The shipped build must be completely local.
- The shipped build must persist data locally.
- The shipped build must be locked to the burger level only.
- Do not reintroduce multiplayer in any form.
- Asset replacement is a later phase; keep it decoupled from core gameplay and persistence.

## Technical guardrails

- Firefox toolbar popups are ephemeral; design for checkpoint/resume and side-panel-style persistence.
- Prefer one reusable extension-owned game surface over duplicate surfaces.
- Keep persistence local to the extension.
- Avoid network requirements for gameplay.
- Preserve clean separation between:
  - trigger logic
  - extension surface management
  - local game simulation
  - bot control
  - save persistence
  - future asset swaps

## Current file map

### Existing extension

- `extension/src/core/background.ts` — idle orchestration
- `extension/src/core/takeover.ts` — current extension-page open/reuse logic
- `extension/src/core/state.ts` — stored extension state
- `extension/src/core/messages.ts` — popup/background message contract
- `extension/src/features/popup/app.ts` — existing toolbar popup UI
- `extension/src/features/takeover/app.ts` — existing fake takeover UI
- `extension/src/entrypoints/takeover/*` — current extension page entrypoint
- `extension/wxt.config.ts` — manifest/action wiring

### Upstream hurrycurry reference

- `client/` — Godot client runtime
- `server/` — Rust server and gameplay authority reference
- `test-client/` — protocol/browser reference client
- `protocol.md` — current network contract

## Recommended execution order

### Phase 1 — repository analysis

Output:

- architecture breakdown
- dependency graph
- networking entry points
- gameplay systems dependent on server state
- gameplay/network coupling points

### Phase 2 — transformation design

Design how to:

- remove server authority
- convert the client into a self-contained simulation
- replace multiplayer synchronization with local state management
- account for popup/side-panel lifecycle resets

### Phase 3 — networking removal

Implement or stage:

- full disablement of server connections
- removal or stubbing of networking layers
- replacement of remote state with local authoritative state

### Phase 4 — bot system

Implement local bots that:

- use the same command/input path as players
- support movement
- support object interaction
- participate in the cooking loop
- start rule-based
- remain extensible for smarter AI later

### Phase 5 — browser + extension compatibility

Prepare for:

- Godot WebAssembly export
- embedding into popup/side-panel UI
- small/resizable viewports
- rapid unload/reload lifecycle
- deterministic startup with lightweight initialization

## Deliverables per phase

At each phase provide:

- architecture summary
- files modified
- rationale for changes
- verification steps

## Done means

- a single-player local game build launches inside the browser extension UI
- no server process is required
- no multiplayer runtime codepath is required for gameplay
- bots replace remote players
- the game survives popup/panel lifecycle resets through local persistence
- only the burger level is exposed
