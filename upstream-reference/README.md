# Upstream Reference - Do Not Edit

This folder is the checked-in **original upstream Hurry Curry reference** used to port behavior into ForkOrFry.

## Rules

- **Do not edit files in this folder as part of normal ForkOrFry work.**
- Treat this as the **source of truth for original behavior, structure, assets, recipes, protocol, and gameplay rules**.
- Port or adapt code **out of this folder into the active extension runtime path** instead of rewriting behavior from scratch when possible.

## Intended use

Use this folder to:

- compare ForkOrFry behavior against upstream
- copy/adapt upstream logic into the extension-owned runtime
- inspect original client/server/bot/recipe/protocol implementation details

## Active ForkOrFry code lives elsewhere

Do active implementation work in tracked project paths like:

- `extension/src/features/runtime-frame/`
- `extension/upstream/hurrycurry-client-overlay/`
- `extension/upstream/generated/`

If something in this folder needs to change, that should usually mean:

1. the upstream reference snapshot itself is being intentionally refreshed, or
2. the change really belongs in an overlay/adaptation file outside this folder.
