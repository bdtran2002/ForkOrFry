# ForkOrFry agent plan

## Objective

Convert this repo into:

- single player only
- no server dependency
- bots replacing all remote players
- a browser-hosted lightweight extension application running inside a popup or side-panel-style container

The final product must run inside a browser extension UI context, not as a full-tab application.

## Development approach

- Treat `upstream-reference/hurrycurry/` as the canonical source for original game behavior, structure, and assets.
- Treat `upstream-reference/` as a visible, read-only original-code snapshot. Do not edit files there during normal ForkOrFry work; port/adapt behavior out of it instead.
- Prefer porting and adapting upstream code over rebuilding equivalent systems from scratch.
- Only replace or trim upstream pieces when they conflict with ForkOrFry requirements:
  - no server runtime
  - single-player only
  - bots replacing remote players
  - burger-level only
  - extension-owned runtime surface
  - local persistence
- New code should be mostly limited to:
  - extension lifecycle and UI hosting
  - local persistence and resume/reset handling
  - local-authority replacements for server-owned systems
  - single-player and level-scope trimming

## Active runtime rule

- The active shipped runtime path is `extension/src/entrypoints/runtime-frame/main.ts` → `extension/src/features/runtime-frame/upstream-runtime.ts`.
- Treat `extension/src/features/runtime-frame/burger-*`, `checkpoint.ts`, and `copy.ts` in that folder as legacy migration scaffolding, not the runtime to keep building.
- Do not add new gameplay logic, reducers, authored level data, or simulation rules to the legacy TypeScript burger runtime path.
- If gameplay behavior must change, prefer one of these paths instead:
  - port/adapt upstream Godot client code under `extension/upstream/hurrycurry-client-overlay/`
  - derive data from `upstream-reference/hurrycurry/` instead of hand-authoring it in TypeScript
  - adapt upstream server gameplay logic into a local-authority replacement only when the upstream client can no longer own that behavior directly

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
- `extension/src/features/runtime-host/*` — extension-owned host shell, lifecycle, checkpoint, and UI scaffolding to keep
- `extension/src/features/runtime-frame/upstream-runtime.ts` — active extension wrapper around the upstream runtime
- `extension/src/features/takeover/app.ts` — existing fake takeover UI
- `extension/src/entrypoints/takeover/*` — current extension page entrypoint
- `extension/src/entrypoints/runtime-frame/main.ts` — active runtime entrypoint
- `extension/wxt.config.ts` — manifest/action wiring

### Legacy migration scaffolding

- `extension/src/features/runtime-frame/burger-*` — frozen custom TypeScript burger runtime; keep only as temporary reference until upstream-derived behavior fully replaces any remaining need for it
- `extension/src/features/runtime-frame/checkpoint.ts` / `copy.ts` — legacy burger-runtime helpers tied to that frozen path

### Upstream hurrycurry reference

- `upstream-reference/hurrycurry/client/` — canonical upstream Godot client runtime to port into the extension-owned surface
- `upstream-reference/hurrycurry/server/` — canonical upstream gameplay authority reference to adapt into local client-owned simulation
- `upstream-reference/hurrycurry/` — full upstream game snapshot; use as reference only, especially `server/bot/` for bot/pathfinding logic
- `upstream-reference/hurrycurry/test-client/` — protocol/browser reference client
- `upstream-reference/hurrycurry/protocol.md` — upstream network contract reference

## Recommended execution order

### Phase 1 — upstream port inventory

Output:

- upstream client systems that can be ported as-is
- upstream client systems that must be adapted for extension hosting
- upstream server systems required for local authority
- gameplay/network coupling points that must be cut or replaced
- multiplayer-only flows that should be removed after the port

### Phase 2 — local-authority port design

Design how to:

- port upstream gameplay into the extension-owned runtime with minimal behavior drift
- remove server authority while preserving upstream gameplay rules
- replace multiplayer synchronization with local state management
- account for popup/side-panel lifecycle resets

### Phase 3 — upstream runtime port

Implement or stage:

- direct port of the upstream runtime/client flow into the extension-hosted surface
- preservation of upstream gameplay behavior unless ForkOrFry constraints require changes
- isolation of networking seams that will be removed or replaced locally

### Phase 4 — local authority conversion

Implement or stage:

- full disablement of server connections
- removal or stubbing of networking layers
- replacement of remote state with local authoritative state using upstream server logic as reference

### Phase 5 — bot system

Implement local bots that:

- use the same command/input path as players
- support movement
- support object interaction
- participate in the cooking loop
- start rule-based
- remain extensible for smarter AI later

Bot implementation should begin from `upstream-reference/hurrycurry/server/bot/`, especially `src/step.rs` and `src/pathfinding.rs`, then be adapted into the local client-owned simulation path.

### Phase 6 — product trimming

Implement or stage:

- lock the shipped game to the burger level only
- remove or disable multiplayer-only modes, UI, and entry paths
- keep asset replacement decoupled from gameplay migration

### Phase 7 — browser + extension compatibility

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

## Upstream port checklist

Reference source: `upstream-reference/hurrycurry/`

### Done

- Upstream client boot path is embedded in the extension runtime surface via:
  - `extension/src/features/runtime-frame/upstream-runtime.ts`
  - `extension/public/upstream/hurrycurry-web/`
  - `extension/upstream/hurrycurry-client-overlay/`
- Upstream-shaped bootstrap/protocol mirroring is in place via:
  - `extension/upstream/generated/burgers-inc-bootstrap.ts`
  - `extension/src/features/runtime-frame/upstream-bridge.ts`
- Current burger-level local-authority coverage exists in:
  - `extension/src/features/runtime-frame/local-authority.ts`
  - movement
  - pickup/place
  - cutting-board prep
  - sink washing
  - renewable sources/plates
  - burger, salad, steak, and fries assembly/cooking paths
  - trash recovery
  - single-customer serve/eat/return loop
  - checkpointed local authority state

### Partial

- `extension/src/features/runtime-frame/local-authority.ts` is still a handwritten TypeScript mirror of an upstream subset, not yet a direct port of upstream gameplay code/data
- customer behavior is simplified relative to upstream `server/bot/src/algos/customer.rs`
- score/session/timer behavior is only partially aligned with upstream `server/game-sim/src/lib.rs`
- recipe coverage is focused on burger-level playability, not full burger-level parity yet

### Missing

- direct bot/pathfinding/tasking port from `upstream-reference/hurrycurry/server/bot/`
- broader direct authority derivation/replacement from:
  - `upstream-reference/hurrycurry/server/game-core/`
  - `upstream-reference/hurrycurry/server/game-sim/`
- final burger-level parity pass for remaining station, customer, and map edge cases
- fully polished local session/start/reset/progression loop inside the extension surface

## Done means

- a single-player local game build launches inside the browser extension UI
- no server process is required
- no multiplayer runtime codepath is required for gameplay
- bots replace remote players
- the game survives popup/panel lifecycle resets through local persistence
- only the burger level is exposed
