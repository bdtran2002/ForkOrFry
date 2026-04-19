# ForkOrFry

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

```bash
cd ForkOrFry
npm install
npm run dev
```

Then open the local Vite URL in your browser.

## Build

```bash
cd ForkOrFry
npm run build
```

## Notes

- Use **Start scrolling** to arm the simulator.
- Stop interacting to trigger the warning, prediction, and result states.
- Use **Fast-forward demo** if you want to test the result state immediately.
