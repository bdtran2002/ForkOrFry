export const runtimeFrameCopy = {
  eyebrow: 'Burger session runtime',
  title: 'Local burger-level session',
  lede:
    'This child runtime now owns a local burger kitchen with explicit crates, walkable tiles, and action-timed single-player state inside the extension host.',
  sessionStatus: 'Runtime state',
  booting: 'Waiting for host boot…',
  phasePrefix: 'Phase',
  directionItems: [
    { id: 'up', label: 'Up', key: 'ArrowUp' },
    { id: 'left', label: 'Left', key: 'ArrowLeft' },
    { id: 'down', label: 'Down', key: 'ArrowDown' },
    { id: 'right', label: 'Right', key: 'ArrowRight' },
  ],
  tileLegend: [
    { id: 'bun-crate', label: 'Bun crate', glyph: 'B' },
    { id: 'patty-crate', label: 'Patty crate', glyph: 'P' },
    { id: 'cheese-crate', label: 'Cheese crate', glyph: 'C' },
    { id: 'grill', label: 'Grill', glyph: 'G' },
    { id: 'board', label: 'Board', glyph: 'A' },
    { id: 'counter', label: 'Counter', glyph: '$' },
  ],
  labels: {
    tick: 'Kitchen tick',
    score: 'Score',
    shift: 'Shift progress',
    location: 'Player position',
    facing: 'Facing',
    heldItem: 'Held item',
    order: 'Live tickets',
    upcomingOrders: 'Queued tickets',
    grill: 'Grill state',
    board: 'Assembly board',
    pantry: 'Pantry stock',
    activeTile: 'Facing tile',
    kitchen: 'Kitchen layout',
    grillPressure: 'Grill window',
  },
  kitchenLegendTitle: 'Kitchen legend',
  logTitle: 'Runtime events',
  completionTitle: 'Burger shift complete',
  completionSummary: (servedCount: number, failedCount: number) =>
    failedCount === 0
      ? `Served all ${servedCount} burger orders and checkpointed the local shift successfully.`
      : `Finished the burger shift with ${servedCount} served and ${failedCount} failed orders.`,
  readySummary: (servedCount: number, failedCount: number) =>
    failedCount === 0
      ? `Shift complete with ${servedCount} served orders.`
      : `Shift complete with ${servedCount} served and ${failedCount} failed orders.`,
  noCurrentOrder: 'No live tickets',
  noUpcomingOrders: 'No more tickets queued',
  noActiveTile: 'No station in reach',
  emptyValue: 'empty',
  grillStates: {
    empty: 'empty',
    cooking: 'cooking',
    cooked: 'cooked',
    burnt: 'burnt',
  },
  grillPressureSummary: (remaining: number) => remaining > 0 ? `${remaining} safe tick${remaining === 1 ? '' : 's'} left` : 'Will burn on the next tick',
  buttons: {
    interact: 'Interact',
    tick: 'Wait',
    reset: 'Reset session',
  },
  movementHint: 'Use the arrow buttons or keyboard arrows to move. Every move, interact, or wait action spends one kitchen tick, so don’t leave cooked patties on the grill for too long.',
  phaseLabels: {
    booting: 'Booting the burger session…',
    running: 'Burger shift running locally.',
    paused: 'Burger session paused by the host.',
    completed: 'Burger shift complete.',
  },
  pausedStatus: 'Runtime paused. Waiting for the host to resume.',
  capabilities: ['checkpoint', 'pause', 'resume', 'local-session'],
} as const
