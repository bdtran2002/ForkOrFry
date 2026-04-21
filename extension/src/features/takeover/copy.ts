export const takeoverCopy = {
  eyebrow: 'ForkOrFry local game shell',
  banner: 'SINGLE PLAYER · OFFLINE · LOCAL SAVE · BURGER LEVEL ONLY',
  title: 'Local game pane placeholder',
  lede:
    'This is the extension-owned surface for the future hurrycurry game shell. The real build will stay local, single-player, and persist progress on the device.',
  sessionStatus: 'Game shell status',
  booting: 'Loading local placeholder...',
  stepPill: (step: number) => `Phase ${step} of 4`,
  stepLabels: ['Local only', 'Single player', 'Persistent save', 'Burger level'],
  logTitle: 'Shell notes',
  completionTitle: 'Ready for integration',
  completionBody:
    'The final game surface will host the local simulation, then hand off to hurrycurry content without reintroducing networking.',
  complete: 'Ready',
  buttons: {
    reset: 'Reset',
    dismiss: 'Close pane',
  },
  note: 'Placeholder only: local, offline, and aligned to the future game shell.',
  fields: [
    { label: 'Mode', value: 'single-player' },
    { label: 'Connectivity', value: 'offline' },
    { label: 'Persistence', value: 'local save' },
    { label: 'Level', value: 'burger only' },
  ],
  logs: [
    'Local game pane opened.',
    'Loaded the extension-owned shell.',
    'Locked to burger level content.',
    'Confirmed offline persistence path.',
    'Waiting for the hurrycurry client integration.',
  ],
  stepStatuses: [
    'Booting the local shell...',
    'Confirming single-player mode...',
    'Preparing local persistence...',
    'Locking the burger level...',
  ],
  completeStatus: 'Placeholder ready. Local-only and safe to replace later.',
} as const
