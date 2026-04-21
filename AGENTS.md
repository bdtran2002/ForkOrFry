# ForkOrFry agent plan

## Objective

Pivot this repo from a fake takeover extension into a Firefox extension that opens a persistent local game surface after inactivity ends and user mouse activity resumes.

## Product rules

- Trigger on inactivity first, then on renewed mouse activity.
- The visible runtime surface must be large and persistent.
- Do not treat the small toolbar popup as the primary gameplay surface.
- The shipped game is a bundled local fork of `hurrycurry`.
- The shipped build must be single-player only.
- The shipped build must be completely local.
- The shipped build must persist data locally.
- The shipped build must be locked to the burger level only.
- Do not reintroduce multiplayer in any form.
- Asset replacement is a later phase; keep that work decoupled from core gameplay and persistence.

## Technical guardrails

- Firefox action popups are ephemeral, so use an extension-owned persistent surface instead.
- Prefer reusing one existing game surface instead of spawning duplicates.
- Keep persistence local to the extension.
- Avoid network requirements for gameplay.
- Preserve a clean separation between:
  - trigger logic
  - surface/window management
  - game integration
  - save persistence
  - future asset swaps

## Current file map

- `extension/src/core/background.ts` — current idle orchestration
- `extension/src/core/takeover.ts` — current extension-page open/reuse logic
- `extension/src/core/state.ts` — stored extension state
- `extension/src/core/messages.ts` — popup/background message contract
- `extension/src/features/popup/app.ts` — existing toolbar popup UI
- `extension/src/features/takeover/app.ts` — existing fake takeover UI
- `extension/src/entrypoints/takeover/*` — current extension page entrypoint
- `extension/wxt.config.ts` — manifest/action wiring

## Recommended execution order

1. Replace the current idle → takeover trigger with inactivity → renewed activity.
2. Introduce a persistent extension-owned game surface.
3. Vendor `hurrycurry` locally into the extension codebase.
4. Remove multiplayer/network behavior.
5. Lock the playable game to the burger level.
6. Add persistent local save/load behavior.
7. Leave hooks for the later art/aesthetic pass.

## Done means

- a single local packaged game build launches from the extension
- the game opens in one persistent extension-owned surface
- repeated triggers reuse that surface
- no multiplayer codepath is required for gameplay
- no remote service is required for gameplay
- progress/state survives reloads via local persistence
- only the burger level is exposed
