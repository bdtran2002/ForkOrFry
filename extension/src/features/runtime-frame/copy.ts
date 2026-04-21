export const runtimeFrameCopy = {
  eyebrow: 'Demo runtime adapter',
  title: 'Local single-player demo runtime',
  lede:
    'This child runtime now boots behind the same contract the future Godot WASM build will use. It remains local, single-player, and burger-level-only in scope.',
  sessionStatus: 'Runtime state',
  booting: 'Waiting for host boot…',
  stepPill: (step: number) => `Phase ${step} of 4`,
  stepLabels: ['Local only', 'Single player', 'Persistent save', 'Burger level'],
  logTitle: 'Runtime events',
  completionTitle: 'Host boundary ready',
  completionBody:
    'This demo runtime can now be swapped for a real local game build without rewriting the extension host or popup lifecycle plumbing.',
  note: 'Current adapter only: the real hurrycurry runtime will replace this child surface later.',
  fields: [
    { label: 'Mode', value: 'single-player' },
    { label: 'Connectivity', value: 'offline' },
    { label: 'Persistence', value: 'host-managed checkpoint' },
    { label: 'Level', value: 'burger only' },
  ],
  logs: [
    'Runtime boot accepted from the host shell.',
    'Loaded the local single-player ruleset placeholder.',
    'Confirmed the runtime stays offline.',
    'Checkpoint bridge connected to the host shell.',
    'Ready to swap in a real local game build.',
  ],
  stepStatuses: [
    'Booting the child runtime…',
    'Confirming single-player mode…',
    'Preparing host-managed checkpoints…',
    'Locking burger-level scope…',
  ],
  pausedStatus: 'Runtime paused. Waiting for the host to resume.',
  completeStatus: 'Demo runtime complete. Boundary is ready for a real embedded build.',
  capabilities: ['checkpoint', 'pause', 'resume'],
} as const
