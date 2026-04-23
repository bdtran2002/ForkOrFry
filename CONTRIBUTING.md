# Contributing

Thanks for helping with ForkOrFry.

This repo is in early beta and active migration. Keep changes small, honest, and easy to review.

## What to focus on

- extension-hosted runtime work
- local-only, single-player behavior
- upstream-port-first changes from `upstream-reference/hurrycurry/`
- browser extension lifecycle, persistence, and UI hosting

## Before opening a PR

- match the existing style
- keep multiplayer/server code out of the shipped path
- avoid broad refactors unless they unblock a port or fix a bug
- test what you changed

## Good PRs

- are scoped to one idea
- explain why the change is needed
- call out any migration tradeoffs

## Not a fit

- new multiplayer features
- server-dependent gameplay
- large design changes without a migration reason

If you are unsure, open an issue first and keep it brief.
