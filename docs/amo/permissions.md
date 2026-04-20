# Permissions rationale

## `idle`

Used to detect when Firefox becomes idle so the local parody takeover can open.

## `storage`

Used to persist extension state such as:

- armed/disarmed mode
- the current takeover tab id
- last trigger timestamp
- selected idle interval

## `tabs`

Used to open, focus, reuse, and close the local takeover tab.

## Not used

- host permissions
- content scripts
- background network requests
- remote code loading
