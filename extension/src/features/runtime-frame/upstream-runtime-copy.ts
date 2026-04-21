export const upstreamRuntimeCopy = {
  eyebrow: 'Upstream runtime adapter',
  title: 'Bundled Hurry Curry web runtime',
  lede:
    'This runtime-frame now targets the real upstream game path. It keeps the existing extension host contract and loads a bundled Godot web export when local export assets are present.',
  sessionStatus: 'Runtime state',
  booting: 'Waiting for host boot…',
  phasePrefix: 'Phase',
  labels: {
    exportState: 'Export status',
    session: 'Session',
    exportPath: 'Export entry',
    checkpoint: 'Checkpoint',
  },
  buttons: {
    refresh: 'Retry export scan',
  },
  capabilities: ['checkpoint', 'pause', 'resume', 'upstream-runtime-shell'],
  phaseLabels: {
    booting: 'Preparing the upstream runtime shell…',
    running: 'Bundled Godot runtime loaded inside the extension.',
    paused: 'Upstream runtime shell paused by the host.',
    ready: 'Upstream runtime shell is ready for a bundled export.',
  },
  exportStates: {
    unknown: 'Checking for bundled export files…',
    missing: 'Bundled export not found yet.',
    ready: 'Bundled export manifest found.',
    loaded: 'Bundled export loaded in the embedded frame.',
    error: 'Bundled export manifest could not be used.',
  },
  notes: [
    'The extension keeps the host shell and checkpoint boundary while the child runtime switches over to the real upstream game path.',
    'Use `npm run sync:godot-web-export -- /absolute/path/to/web-export` in `extension/` after producing a Godot web export.',
    'The sync script copies export files into `extension/public/upstream/hurrycurry-web/` so the shipped extension can run offline.',
  ],
  missingSummary:
    'No local Godot web export is bundled yet. The adapter shell is ready, but the actual upstream game files still need to be copied into the extension.',
  errorSummary: (detail: string) => `Bundled export metadata could not be loaded: ${detail}`,
  readySummary: (path: string) => `Manifest found. Loading bundled export from ${path}.`,
  loadedSummary: 'Bundled export iframe loaded.',
  checkpointSummary: (reason: string | null) => reason ? `Last checkpoint: ${reason}` : 'No explicit checkpoint request yet.',
} as const
