# Branch log: runtime host → upstream client pivot

Updated: 2026-04-21  
Base on main: `origin/main` @ `567e5b8`  
Current HEAD: `42b2ffa` on local branch `pivot/upstream-client-adapter`

## Follow-up note after this log

This log still captures the runtime-host branch history accurately, but the branch direction after that checkpoint is now:

- keep the host/runtime seam
- keep the host-owned checkpoint model
- support both a popup-window host and a full-tab host for the same run
- stop expanding the custom burger runtime except where it directly helps the upstream path
- treat the custom burger runtime below as historical migration scaffolding, not the active shipped runtime
- keep the active runtime path on `entrypoints/runtime-frame/main.ts` → `features/runtime-frame/upstream-runtime.ts`
- replace gameplay/runtime behavior by porting upstream code, not by extending the TypeScript burger scaffold

## Scope of this log

This log covers **everything added after `origin/main`** and before starting the new upstream-integration slice.

Historical note:
- The burger-runtime sections below are branch history, not the current recommended implementation path.

Important note:
- The gameplay/runtime work was done on `pivot/runtime-host-boundary`.
- `pivot/upstream-client-adapter` was just created from that HEAD.
- So the code state on this branch currently includes **all** of the runtime-host and burger-runtime work below.

## Exact commit log since `origin/main`

1. `017d948 feat: add a runtime host boundary`
   - Replaced the direct takeover page flow with an extension-owned host shell + child runtime frame.
   - Added runtime host contract, controller, checkpoint store, and runtime-frame entrypoint.

2. `5ea128b feat: surface runtime host session status`
   - Added popup/runtime status wiring for the host session.
   - Introduced runtime-definition wiring and host-session visibility in the popup.

3. `6dab85d feat: clear runtime host state on reset`
   - Reset now clears runtime-host checkpoint/session state, not just idle/window state.

4. `bdc6eca refactor: remove the old takeover placeholder`
   - Removed the older standalone takeover placeholder path from active use.
   - Documentation updated to point to the runtime-host/runtime-frame architecture instead.

5. `223b023 feat: add a local burger session runtime`
   - Replaced the demo adapter with the first reducer-driven local burger runtime.
   - Added burger level data, reducer state, checkpoint support, and burger-session tests.

6. `2c3cd44 refactor: remove the old demo runtime adapter`
   - Deleted the old demo runtime implementation after the burger runtime replaced it.

7. `24b5ab1 docs: refresh the runtime host README`
   - Updated README so it matched the runtime-host branch reality and cleaner badge/status presentation.

8. `7f84218 fix: harden runtime host review fixes`
   - Fixed review findings in background reset handling, popup reset state, runtime-host storage, message validation, controller serialization, unload/pagehide behavior, and related tests.

9. `a5cbb1c feat: turn the burger loop into a shift`
   - Expanded the single-order burger loop into a multi-order burger shift.

10. `d5cb5a9 feat: make burger orders recipe-driven`
    - Replaced hardcoded burger handling with recipe-aware orders (`plain-burger`, `cheeseburger`).
    - Made board assembly and serving validate against recipes.

11. `a1ccdba feat: add a spatial burger kitchen layout`
    - Replaced abstract station-jump logic with a tiny authored kitchen map.
    - Added explicit crates, grill, board, counter, walkable tiles, player position/facing, and map rendering.

12. `ba51957 feat: make burger actions consume kitchen time`
    - Movement, interaction, and wait now all spend a kitchen tick.
    - Order timers and grill timing now advance through actual actions.

13. `ae13b0c docs: clarify the action-timed kitchen loop`
    - Updated runtime copy/UI wording so the action-timed rules were visible in the runtime.

14. `ab9b1a0 feat: add grill burn pressure to the burger loop`
    - Added `cooking -> cooked -> burnt` grill progression.
    - Added burnt-grill clearing and checkpoint/version updates.

15. `eea4259 feat: surface grill pressure in the runtime UI`
    - Added grill pressure readout to the runtime HUD.

16. `c386da4 feat: run overlapping live tickets in the burger shift`
    - Shift moved from one active ticket to two concurrent live tickets with queue backfill.

17. `da56b1b feat: pace the burger shift with scheduled tickets`
    - Added schedule-based ticket release using `releaseTick`.
    - Allowed lull periods and authored rush timing.

18. `458758b feat: show scheduled rush timing in the runtime HUD`
    - Added HUD support for queued ticket countdowns and next-ticket timing.

19. `6875055 feat: add prep-ahead burger staging`
    - Added 1-slot counter pass staging for finished burgers.
    - Allowed prep during lull periods and non-destructive wrong-order interactions.

20. `4ab6762 feat: show staged burgers on the counter pass`
    - Added HUD/copy for the staged counter burger state.

21. `42b2ffa wip: park partial burger assembly work`
    - Parked in-progress work for explicit partial burger assemblies.
    - This adds burger-specific partial-build items that can exist in hand / on the board / on the counter.
    - This was intentionally committed as `wip:` so we could stop deepening the custom runtime and pivot.

## Files changed since `origin/main`

### Docs
- `README.md`
- `docs/pivot-analysis.md`

### Extension lifecycle / popup
- `extension/src/core/background.ts`
- `extension/src/features/popup/app.ts`
- `extension/src/features/popup/copy.ts`

### Entrypoints
- `extension/src/entrypoints/takeover/index.html`
- `extension/src/entrypoints/takeover/main.ts`
- `extension/src/entrypoints/runtime-frame/index.html`
- `extension/src/entrypoints/runtime-frame/main.ts`

### Runtime host shell
- `extension/src/features/runtime-host/app.ts`
- `extension/src/features/runtime-host/checkpoint-store.ts`
- `extension/src/features/runtime-host/contract.ts`
- `extension/src/features/runtime-host/controller.ts`
- `extension/src/features/runtime-host/copy.ts`
- `extension/src/features/runtime-host/runtime-definition.ts`

### Runtime frame / custom burger runtime
- `extension/src/features/runtime-frame/burger-level.ts`
- `extension/src/features/runtime-frame/burger-runtime.ts`
- `extension/src/features/runtime-frame/burger-session-reducer.ts`
- `extension/src/features/runtime-frame/burger-session-state.ts`
- `extension/src/features/runtime-frame/checkpoint.ts`
- `extension/src/features/runtime-frame/copy.ts`

### Removed or retired older runtime path pieces
- `extension/src/features/takeover/app.ts`
- `extension/src/features/takeover/copy.ts`
- `extension/src/features/takeover/session.ts`

### Styling
- `extension/src/style.css`

### Tests
- `extension/tests/background.test.ts`
- `extension/tests/popup-app.test.ts`
- `extension/tests/runtime-host.test.ts`
- `extension/tests/burger-session.test.ts`

## What the branch currently does

### Extension shell / host side
- Keeps the Firefox idle → activity trigger flow.
- Opens the runtime in the extension-owned host shell.
- Persists runtime-host session/checkpoint state.
- Supports reset/pause/resume/shutdown and popup status.

### Current child runtime
- The child runtime is still a **custom TypeScript burger runtime**, not the real upstream game.
- It currently supports:
  - recipe-driven burgers
  - spatial kitchen movement
  - action-timed moves / interacts / waits
  - grill cooking + burning
  - overlapping active tickets
  - scheduled rush pacing
  - prep-ahead counter staging
  - parked WIP partial assembly support

## What is still not done

- We have **not** integrated the real upstream `hurrycurry` client yet.
- We have **not** removed multiplayer/server coupling from the real upstream game yet.
- We have **not** switched the runtime-frame over to a real upstream adapter path yet.
- We have **not** done Godot/WASM packaging/integration work on this branch yet.

## What I want to accomplish next

The direction change is:

### Stop deepening the custom burger runtime
- Keep the current custom runtime work as scaffolding/reference.
- Do not keep investing in bespoke gameplay unless it directly helps the upstream path.

### Use the existing host/runtime seam as the permanent shell
- Keep:
  - `runtime-host/*`
  - popup/background lifecycle
  - checkpoint-store / reset / pause / resume handling
- Replace the child runtime contents, not the shell architecture.

### First upstream-integration target
- Start a **local upstream bootstrap adapter** in the runtime-frame slot.
- Use the real upstream `burgers_inc` data and map shape as the source of truth.
- Prove that the extension host can boot a local upstream-shaped runtime path with:
  - real map/bootstrap data
  - real collision/movement baseline
  - local-only session state
  - host checkpoints

### Then follow with
1. strip or bypass multiplayer/server-dependent startup paths
2. replace external/network authority with a local adapter
3. progressively swap more of the custom TS runtime out for upstream-derived behavior
4. only after that, decide how/when to land the Godot/WASM runtime path inside the same shell

## Immediate next recommendation

The next slice should be:

- create an **upstream adapter runtime** in `extension/src/features/runtime-frame/`
- point `extension/src/entrypoints/runtime-frame/main.ts` at that adapter instead of continuing the burger reducer path
- use normalized checked-in upstream `burgers_inc` data rather than broad vendoring first

This is the cleanest way to stop building “our own game” and start moving the branch toward the actual forked game.
