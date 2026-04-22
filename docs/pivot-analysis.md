# ForkOrFry pivot analysis

This document records the repository analysis and migration design for pivoting ForkOrFry into a browser-extension-hosted local game build based on `hurrycurry`.

## Current implementation update

Since the original analysis pass, the repo now has:

- an extension-owned runtime host shell
- a typed host/runtime iframe boundary
- host-owned checkpoint persistence
- popup-window and full-tab host surfaces for the same local session

The current child runtime is still a custom TypeScript burger scaffold. It is useful as migration scaffolding, but it is not the final runtime direction. The next implementation slices should focus on replacing that child runtime with an upstream-derived local adapter, not on expanding the scaffolded gameplay path.

## Scope

Target outcome:

- single player only
- no server dependency
- bots replacing all remote players
- Godot WebAssembly export inside an extension popup or side-panel-style UI

Hard constraints:

- no Docker
- do not build or deploy the Rust server
- server code is reference only
- client must fully own game state
- runtime must tolerate constrained viewport size and frequent unload/reload behavior

---

## Phase 1 — repository analysis

### Architecture summary

#### Extension repo

- `extension/` currently contains a Firefox MV3 WXT extension.
- `extension/src/core/background.ts` handles idle detection and trigger orchestration.
- `extension/src/core/takeover.ts` opens/reuses the current extension-owned host surface.
- `extension/src/core/state.ts` stores extension state in `browser.storage.local`.
- `extension/src/features/popup/app.ts` is the current toolbar popup UI.
- `extension/src/features/runtime-host/app.ts` is the current extension-owned runtime host shell.
- `extension/src/features/runtime-frame/burger-runtime.ts` is the current local burger-session child runtime behind that host boundary.

#### Upstream hurrycurry

- `client/` is the Godot client.
- `server/` is the Rust server authority and simulation host.
- `test-client/` is a TypeScript websocket client that mirrors protocol behavior.
- `protocol.md` defines the websocket/JSON multiplayer protocol.

### High-level dependency graph

```text
ForkOrFry extension
├── background idle trigger
├── popup / host launcher UI
└── local browser.storage.local state

hurrycurry
├── client/ (Godot runtime)
│   └── depends on websocket protocol + server state
├── test-client/ (browser websocket client)
│   └── depends on protocol.ts + server packets
├── server/
│   ├── main.rs / state.rs / server.rs authority layer
│   ├── game-sim/ gameplay simulation
│   ├── bot/ local bot logic reference
│   └── network/ discovery + registry + transport helpers
└── data/ gameplay data
```

### Network flow mapping

Current upstream runtime flow:

1. client connects to server via websocket
2. server sends version/game/state bootstrap packets
3. client sends `join`
4. client sends `keepalive`, `movement`, and `interact`
5. server remains authoritative for movement, interactions, map state, scoring, and player lifecycle
6. server broadcasts updates back to all connected players

### Networking entry points

- `/tmp/hurrycurry-forkorfry/test-client/main.ts` — websocket bootstrap with `new WebSocket(...)`
- `/tmp/hurrycurry-forkorfry/client/multiplayer.gd` — Godot websocket connection and packet bridge
- `/tmp/hurrycurry-forkorfry/server/src/main.rs` — TCP/websocket server listener
- `/tmp/hurrycurry-forkorfry/server/src/state.rs` — connection registry, broadcast state, timeouts
- `/tmp/hurrycurry-forkorfry/server/src/server.rs` — packet validation and routing into gameplay
- `/tmp/hurrycurry-forkorfry/server/src/network/register.rs` — registry registration
- `/tmp/hurrycurry-forkorfry/server/src/network/mdns.rs` — local discovery
- `/tmp/hurrycurry-forkorfry/server/src/network/upnp.rs` — port-mapping/network convenience
- `/tmp/hurrycurry-forkorfry/server/discover/src/main.rs` — discovery tooling
- `/tmp/hurrycurry-forkorfry/server/registry/src/*` — registry service code

### Gameplay systems dependent on server state

- player identity, join/leave, and spawn flow
- movement synchronization and correction
- interaction handling and item transfer
- tile/item progress timers
- map/game bootstrap and reset
- pause/lobby/readiness state
- vote/game lifecycle systems
- score and hint/message broadcast
- disconnect/timeout handling

### Coupling points between gameplay and networking

- `client/game.gd` handles packet types directly and mutates gameplay state from them.
- `client/multiplayer.gd` is the core transport bridge for the Godot client.
- `client/player/controllable_player.gd` sends gameplay actions through multiplayer APIs.
- `test-client/player/controller.ts` maps local input directly into network packets.
- `test-client/player/players.ts` renders authoritative remote player state.
- `server/src/server.rs` and `server/src/state.rs` combine connection management with game authority.
- `server/game-sim/` and `server/bot/` contain gameplay logic that currently assumes a server-owned simulation.

### Phase 1 rationale

The upstream game is strongly server-authoritative. A successful browser-extension port needs to preserve gameplay rules while severing runtime dependence on websocket transport, server discovery, and server-owned authority.

### Phase 1 verification

- inspected upstream `README.md`, `client/README.md`, `server/README.md`, `protocol.md`, `COPYING`, and `rust-toolchain`
- inspected current ForkOrFry extension file map
- summarized networking and coupling points before modifying runtime code

### Phase 1 files modified

- none; analysis only

---

## Phase 2 — transformation design

### Recommended architecture

Use a local-authoritative session inside the Godot client, hosted in an extension popup/side-panel-style surface.

Recommended shape:

- replace websocket transport with a local session engine
- keep packet-shaped event boundaries where practical so existing client rendering/UI can be adapted incrementally
- treat server code as gameplay reference only
- run one human player plus local bots in a single in-process simulation

### Remove server authority

- eliminate websocket, keepalive, discovery, registry, and version-handshake requirements
- move authoritative game simulation into the local runtime
- feed human input into a fixed-step local simulation rather than across a network bridge
- emit local gameplay events/deltas to the UI layer

### Replace multiplayer synchronization with local state

- replace remote synchronization with local snapshots/checkpoints
- keep one authoritative local state tree for players, bots, timers, items, score, and map progression
- lock scope to the burger level so only required systems are ported first

### Bot strategy

- replace remote players with local bots using the same command path as human input
- start with rule-based waiter/prep helpers
- support movement, interaction, and cooking-loop participation
- keep the bot layer extensible for smarter AI later

### Browser/extension compatibility design

- primary runtime should feel like an extension popup/pane app, not a full tab
- the host may support both popup-window and full-tab surfaces as long as the runtime remains extension-owned and session state stays singular
- popup lifecycle may unload frequently, so plan around checkpoint/resume
- prefer a side-panel-style host when persistence matters most
- popup UI can act as launcher/status UI if a more persistent pane is needed
- startup must be deterministic and lightweight on each open

### Persistence assumptions

- use extension-owned local persistence as the source of truth
- store settings plus hot session checkpoints
- checkpoint on important transitions and on unload/hide
- restore quickly from versioned snapshots

### Phase 2 risks

- logic drift from server reference behavior
- popup/side-panel unload causing lost state
- Godot WASM startup/performance in constrained extension UI
- over-porting unused multiplayer/general-purpose systems
- bot pathing quality on the burger level

### Phase 2 rationale

Keeping packet-shaped seams while removing live networking offers the safest path: it minimizes client rewrite cost while replacing the hardest runtime dependency first.

### Phase 2 verification

- reviewed current extension constraints
- reviewed upstream protocol and server-authority design
- mapped a local-authoritative replacement architecture before implementation

### Phase 2 files modified

- none; design only

---

## Phase 3–5 staged implementation targets

### Phase 3 — networking removal

- disable all server connection attempts
- stub or remove transport layers
- route gameplay through local authoritative state only

### Phase 4 — bot system

- create local bots using input/command-driven behavior
- start rule-based and burger-level-specific
- verify movement, interaction, and cooking participation

### Phase 5 — browser + extension compatibility

- package Godot WebAssembly build into the extension
- fit runtime into popup/side-panel-style constraints
- optimize startup, pause/resume, and checkpoint persistence

## Implementation notes

- The final shipped runtime should not require the Rust server.
- Multiplayer networking should not remain as a required runtime path.
- If popup-only proves too ephemeral, retain popup semantics for launch/control and keep the actual playable surface within a more persistent extension-owned pane.
