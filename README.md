# ForkOrFry

[![CI](https://github.com/bdtran2002/ForkOrFry/actions/workflows/ci.yml/badge.svg)](https://github.com/bdtran2002/ForkOrFry/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](./LICENSE)

An idle-triggered CS future-predicting simulator that gives you a preview of your future putting the fries in the bag when you spend too long scrolling reels on your phone.

## What it is

ForkOrFry is a small TypeScript + Vite single-page experience that watches for inactivity and escalates through a fake career forecast:

- `intro` → waiting to start
- `active` → user is still interacting
- `warning` → doomscroll risk rising
- `predicting` → fast-food destiny calculation in progress
- `result` → absurd prophecy delivered

The app also keeps the current phase in `localStorage`, so panic-refreshing does not immediately save you.

## Run locally

The frontend app lives in the nested `ForkOrFry/` folder.

Requires Node `^20.19.0 || >=22.12.0`.

```bash
cd ForkOrFry
npm install
npm run dev
```

Then open the local Vite URL in your browser.

## Verification

```bash
cd ForkOrFry
npm run lint
npm run build
```

`npm run build` remains the main full verification check.

## Build

```bash
cd ForkOrFry
npm run build
```

## Notes

- Use **Start scrolling** to arm the simulator.
- Stop interacting to trigger the warning, prediction, and result states.
- Use **Fast-forward demo** if you want to test the result state immediately.
