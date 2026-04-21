This directory is the checked-in target for the bundled Godot web export that the
extension will ship offline.

Expected workflow:

1. Produce a Godot web export for the upstream Hurry Curry client.
2. Run `npm run sync:godot-web-export -- /absolute/path/to/export` from `extension/`.
3. Commit the copied export files here once the runtime is ready to ship them.

The sync script writes `manifest.json` into this folder so the runtime-frame
adapter can find the correct HTML entrypoint.
