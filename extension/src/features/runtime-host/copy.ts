export const runtimeHostCopy = {
  eyebrow: 'ForkOrFry runtime host',
  banner: 'EXTENSION-OWNED HOST · LOCAL SESSION · SINGLE-PLAYER PIVOT',
  title: 'Extension runtime host',
  lede:
    'This surface boots the upstream-derived child runtime inside an extension-owned host shell. The host/checkpoint boundary is the permanent seam for the single-player extension build.',
  labels: {
    status: 'Host status',
    lifecycle: 'Lifecycle',
    surface: 'Surface',
    runtime: 'Runtime',
    session: 'Session',
    resumeCount: 'Resume count',
    lastCheckpoint: 'Last checkpoint',
  },
  runtimeCardTitle: 'Embedded runtime',
  runtimeCardBody:
    'The iframe below runs the current upstream runtime wrapper for the local hurrycurry build. It already runs behind the same boot/checkpoint/pause/resume boundary.',
  notesTitle: 'What changed in this slice',
  notes: [
    'The host shell owns checkpoint storage instead of the child runtime page.',
    'The child runtime boots through a typed contract instead of direct page logic.',
    'The host can now support both a popup window and a full-tab surface without duplicating runtime logic.',
  ],
  buttons: {
    openFullTab: 'Move to full tab',
    reset: 'Reset runtime',
    closeWindow: 'Close window',
    closeTab: 'Close tab',
  },
  surfaces: {
    popupWindow: 'Popup window',
    fullTab: 'Full tab',
  },
  booting: 'Booting child runtime…',
  emptyCheckpoint: 'Not yet',
} as const
