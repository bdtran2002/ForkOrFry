export const upstreamRuntimeCopy = {
  title: 'Bundled Hurry Curry web runtime',
  statusLabel: 'Runtime status',
  booting: 'Waiting for host boot…',
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
    booting: 'Preparing runtime shell…',
    running: 'Bundled Godot runtime loaded.',
    paused: 'Runtime paused by host.',
    ready: 'Ready for bundled export.',
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
  missingSummary:
    'No local Godot web export is bundled yet.',
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
