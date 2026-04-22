# Permissions rationale

## `idle`

Used to detect when Firefox becomes idle so the extension can reopen the local game host on renewed activity.

## `storage`

Used to persist extension state such as:

- armed/disarmed mode
- the currently active host surface and surface ids
- last trigger timestamp
- selected idle interval
- runtime host checkpoints

## `tabs`

Used to open, focus, reuse, and close the extension-owned full-tab host surface.

## `windows`

Used to open, focus, reuse, and close the extension-owned popup-window host surface.

## Not used

- host permissions
- content scripts
- background network requests
- remote code loading
