export const runtimeFrameCopy = {
  eyebrow: 'Burger session runtime',
  title: 'Local burger-level session',
  lede:
    'This child runtime now owns a real local-only burger session state tree. It stays single-player, offline, and checkpointable inside the extension host.',
  sessionStatus: 'Runtime state',
  booting: 'Waiting for host boot…',
  phasePrefix: 'Phase',
  locationItems: [
    { id: 'storage', label: 'Storage' },
    { id: 'grill', label: 'Grill' },
    { id: 'board', label: 'Board' },
    { id: 'counter', label: 'Counter' },
  ],
  labels: {
    tick: 'Kitchen tick',
    score: 'Score',
    shift: 'Shift progress',
    location: 'Player station',
    heldItem: 'Held item',
    order: 'Current order',
    upcomingOrders: 'Upcoming orders',
    grill: 'Grill state',
    board: 'Assembly board',
    pantry: 'Pantry stock',
  },
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
  noCurrentOrder: 'Shift complete',
  noUpcomingOrders: 'No more orders queued',
  emptyValue: 'empty',
  buttons: {
    interact: 'Interact',
    tick: 'Advance tick',
    reset: 'Reset session',
  },
  phaseLabels: {
    booting: 'Booting the burger session…',
    running: 'Burger shift running locally.',
    paused: 'Burger session paused by the host.',
    completed: 'Burger shift complete.',
  },
  pausedStatus: 'Runtime paused. Waiting for the host to resume.',
  capabilities: ['checkpoint', 'pause', 'resume', 'local-session'],
} as const
