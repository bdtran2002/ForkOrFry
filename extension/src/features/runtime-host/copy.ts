export const runtimeHostCopy = {
  eyebrow: 'ForkOrFry runtime host',
  banner: 'EXTENSION-OWNED HOST · LOCAL SESSION · READY FOR GODOT WASM',
  title: 'Runtime host boundary',
  lede:
    'This window now boots a child runtime inside an extension-owned host shell. The child is a real local burger-session runtime, and checkpointing plus resume flow through a reusable host contract.',
  labels: {
    status: 'Host status',
    runtime: 'Runtime',
    session: 'Session',
    resumeCount: 'Resume count',
    lastCheckpoint: 'Last checkpoint',
  },
  runtimeCardTitle: 'Embedded runtime',
  runtimeCardBody:
    'The iframe below is the current burger-level runtime and the future handoff point for the local hurrycurry build. It already runs behind the same boot/checkpoint/pause/resume boundary.',
  notesTitle: 'What changed in this slice',
  notes: [
    'The host shell owns checkpoint storage instead of the child runtime page.',
    'The child runtime boots through a typed contract instead of direct page logic.',
    'Swapping the current burger runtime for Godot WASM is now localized to the embedded child surface.',
  ],
  buttons: {
    reset: 'Reset runtime',
    dismiss: 'Close pane',
  },
  booting: 'Booting child runtime…',
  emptyCheckpoint: 'Not yet',
} as const
