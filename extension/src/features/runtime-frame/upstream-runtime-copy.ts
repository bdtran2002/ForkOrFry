export const upstreamRuntimeCopy = {
  labels: {
    exportState: 'Export state',
    bridgeState: 'Bridge state',
    godotBridge: 'Bridge snapshot',
    session: 'Session',
    exportPath: 'Export path',
    checkpoint: 'Checkpoint',
    gameplayPackets: 'Packets',
    gameplaySummary: 'Packet summary',
  },
  phaseLabels: {
    booting: 'Preparing runtime…',
    running: 'Runtime loaded.',
    paused: 'Paused by host.',
    ready: 'Ready.',
  },
  exportStates: {
    unknown: 'Checking export files…',
    missing: 'Export not found yet.',
    ready: 'Export manifest found.',
    loaded: 'Export loaded in the frame.',
    error: 'Export manifest could not be used.',
  },
  bridgeStates: {
    idle: 'Waiting for boot.',
    waiting: 'Bootstrap payload ready.',
    sent: 'Bootstrap payload sent.',
    acknowledged: 'Bootstrap acknowledged.',
    error: 'Bridge error.',
  },
  missingSummary:
    'No local export is bundled yet.',
  errorSummary: (detail: string) => `Export metadata could not be loaded: ${detail}`,
  readySummary: (path: string) => `Manifest found. Loading export from ${path}.`,
  loadedSummary: 'Export iframe loaded.',
  checkpointSummary: (reason: string | null) => reason ? `Last checkpoint: ${reason}` : 'No checkpoint yet.',
  gameplayPacketsSummary: (packets: { action: string }[]) => packets.length ? `${packets.length} gameplay packet${packets.length === 1 ? '' : 's'} received.` : 'No gameplay packets yet.',
  gameplayPacketSummary: (summary: { totalCount: number, lastAction: string | null, actionCounts: Record<string, number> }) => {
    if (!summary.totalCount) return 'No gameplay packets yet.'

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
    if (!entryState && !lastUpdate) return 'No bridge data yet.'

    return [
      entryState ? `entry: ${entryState}` : null,
      lastUpdate ? `last update: ${lastUpdate}` : null,
    ].filter(Boolean).join(' • ')
  },
} as const
