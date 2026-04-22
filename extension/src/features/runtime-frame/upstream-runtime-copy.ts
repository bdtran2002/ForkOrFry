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
    bridgeState: 'Bootstrap bridge',
    godotBridge: 'Godot bridge',
    session: 'Session',
    exportPath: 'Export entry',
    checkpoint: 'Checkpoint',
    gameplayPackets: 'Gameplay packets',
    gameplaySummary: 'Packet summary',
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
  bridgeStates: {
    idle: 'Waiting for a session boot.',
    waiting: 'Bootstrap payload prepared for the embedded runtime.',
    sent: 'Bootstrap payload sent to the embedded runtime.',
    acknowledged: 'Embedded runtime acknowledged the bootstrap payload.',
    error: 'Embedded runtime bridge reported an error.',
  },
  notes: [
    'The extension keeps the host shell and checkpoint boundary while the child runtime switches over to the real upstream game path.',
    'Use `npm run sync:godot-web-export -- /absolute/path/to/web-export` in `extension/` after producing a Godot web export.',
    'The sync script copies export files into `extension/public/upstream/hurrycurry-web/` so the shipped extension can run offline.',
    'The adapter now prepares packet-shaped local bootstrap data and posts it into the bundled runtime iframe once the embedded page is ready.',
  ],
  missingSummary:
    'No local Godot web export is bundled yet. The adapter shell is ready, but the actual upstream game files still need to be copied into the extension.',
  errorSummary: (detail: string) => `Bundled export metadata could not be loaded: ${detail}`,
  readySummary: (path: string) => `Manifest found. Loading bundled export from ${path}.`,
  loadedSummary: 'Bundled export iframe loaded.',
  checkpointSummary: (reason: string | null) => reason ? `Last checkpoint: ${reason}` : 'No explicit checkpoint request yet.',
  gameplayPacketsSummary: (packets: { action: string }[]) => packets.length ? `${packets.length} outbound gameplay packet${packets.length === 1 ? '' : 's'} received.` : 'No outbound gameplay packets received yet.',
  gameplayPacketSummary: (summary: { totalCount: number, lastAction: string | null, actionCounts: Record<string, number> }) => {
    if (!summary.totalCount) return 'No gameplay packets received yet.'

    const counts = Object.entries(summary.actionCounts)
      .slice(0, 3)
      .map(([action, count]) => `${action}: ${count}`)

    return [
      `total: ${summary.totalCount}`,
      summary.lastAction ? `last: ${summary.lastAction}` : null,
      counts.length ? `counts: ${counts.join(', ')}` : null,
    ].filter(Boolean).join(' • ')
  },
  godotBridgeSummary: (entryState: string | null, lastUpdate: string | null) => {
    if (!entryState && !lastUpdate) return 'No live Godot bridge data yet.'

    return [
      entryState ? `entry: ${entryState}` : null,
      lastUpdate ? `last update: ${lastUpdate}` : null,
    ].filter(Boolean).join(' • ')
  },
} as const
