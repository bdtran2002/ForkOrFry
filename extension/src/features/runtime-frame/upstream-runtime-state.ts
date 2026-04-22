export const UPSTREAM_RUNTIME_SAVE_VERSION = 1 as const
export const UPSTREAM_RUNTIME_GAMEPLAY_PACKET_HISTORY_LIMIT = 25

import type { UpstreamBridgeSnapshot, UpstreamBridgeState } from './upstream-bridge'

export type UpstreamRuntimeExportState = 'unknown' | 'missing' | 'ready' | 'loaded' | 'error'

export interface UpstreamRuntimeState {
  saveVersion: typeof UPSTREAM_RUNTIME_SAVE_VERSION
  sessionId: string
  phase: 'booting' | 'running' | 'paused' | 'ready'
  exportState: UpstreamRuntimeExportState
  bridgeState: UpstreamBridgeState
  detail: string
  exportUrl: string | null
  lastCheckpointReason: string | null
  bootstrapPacketCount: number
  bridgeSnapshot: UpstreamBridgeSnapshot
  gameplayPackets: { action: string, payload: Record<string, unknown>, receivedAt: string }[]
  gameplayPacketSummary: {
    totalCount: number
    lastAction: string | null
    actionCounts: Record<string, number>
  }
}

export function createInitialUpstreamBridgeSnapshot(): UpstreamBridgeSnapshot {
  return {
    acknowledgedSessionId: null,
    acknowledgedPacketCount: 0,
    lastError: null,
  }
}

export function restoreUpstreamBridgeSnapshotForSession(
  snapshot: UpstreamBridgeSnapshot,
  sessionId: string,
): UpstreamBridgeSnapshot {
  return {
    acknowledgedSessionId: snapshot.acknowledgedSessionId === sessionId ? snapshot.acknowledgedSessionId : null,
    acknowledgedPacketCount: snapshot.acknowledgedSessionId === sessionId ? snapshot.acknowledgedPacketCount : 0,
    lastError: null,
  }
}

export function acknowledgeUpstreamBridgeSnapshot(
  snapshot: UpstreamBridgeSnapshot,
  sessionId: string,
  packetCount: number,
): UpstreamBridgeSnapshot {
  return {
    ...snapshot,
    acknowledgedSessionId: sessionId,
    acknowledgedPacketCount: packetCount,
    lastError: null,
  }
}

export function errorUpstreamBridgeSnapshot(
  snapshot: UpstreamBridgeSnapshot,
  detail: string,
): UpstreamBridgeSnapshot {
  return {
    ...snapshot,
    lastError: detail,
  }
}

export function isUpstreamRuntimeSessionReused(
  snapshot: UpstreamBridgeSnapshot,
  sessionId: string,
) {
  return snapshot.acknowledgedSessionId === sessionId
}

export function resolveUpstreamRuntimeSessionState(
  snapshot: UpstreamBridgeSnapshot,
  sessionId: string,
) {
  return {
    sessionId,
    reused: isUpstreamRuntimeSessionReused(snapshot, sessionId),
    bridgeSnapshot: restoreUpstreamBridgeSnapshotForSession(snapshot, sessionId),
  }
}

export function isUpstreamRuntimeGameplayPacket(value: unknown): value is UpstreamRuntimeState['gameplayPackets'][number] {
  return (
    typeof value === 'object'
    && value !== null
    && typeof (value as { action?: unknown }).action === 'string'
    && typeof (value as { receivedAt?: unknown }).receivedAt === 'string'
    && typeof (value as { payload?: unknown }).payload === 'object'
    && (value as { payload?: unknown }).payload !== null
  )
}

export function trimUpstreamRuntimeGameplayPackets(packets: UpstreamRuntimeState['gameplayPackets']) {
  return packets.slice(-UPSTREAM_RUNTIME_GAMEPLAY_PACKET_HISTORY_LIMIT)
}

export function summarizeUpstreamRuntimeGameplayPackets(packets: UpstreamRuntimeState['gameplayPackets']) {
  const actionCounts: Record<string, number> = {}
  let lastAction: string | null = null

  for (const packet of packets) {
    if (!isUpstreamRuntimeGameplayPacket(packet)) continue
    actionCounts[packet.action] = (actionCounts[packet.action] ?? 0) + 1
    lastAction = packet.action
  }

  return {
    totalCount: packets.length,
    lastAction,
    actionCounts,
  }
}

export function createInitialUpstreamRuntimeState(): UpstreamRuntimeState {
  return {
    saveVersion: UPSTREAM_RUNTIME_SAVE_VERSION,
    sessionId: '',
    phase: 'booting',
    exportState: 'unknown',
    bridgeState: 'idle',
    detail: 'Waiting for host boot…',
    exportUrl: null,
    lastCheckpointReason: null,
    bootstrapPacketCount: 0,
    bridgeSnapshot: createInitialUpstreamBridgeSnapshot(),
    gameplayPackets: [],
    gameplayPacketSummary: {
      totalCount: 0,
      lastAction: null,
      actionCounts: {},
    },
  }
}

export function describeUpstreamRuntimeSession(sessionId: string, reused: boolean) {
  const shortSessionId = sessionId.slice(0, 9)

  return reused
    ? `Reusing checkpointed session ${shortSessionId}.`
    : `Boot accepted for ${shortSessionId}.`
}

export function createBootUpstreamRuntimeState(
  restored: UpstreamRuntimeState,
  sessionId: string,
  bootstrapPacketCount: number,
): UpstreamRuntimeState {
  const resolvedSession = resolveUpstreamRuntimeSessionState(restored.bridgeSnapshot, sessionId)

  return {
    ...restored,
    sessionId: resolvedSession.sessionId,
    phase: 'booting' as const,
    bridgeState: 'waiting' as const,
    bootstrapPacketCount,
    bridgeSnapshot: resolvedSession.bridgeSnapshot,
    detail: describeUpstreamRuntimeSession(resolvedSession.sessionId, resolvedSession.reused),
  }
}

export function createResumeUpstreamRuntimeState(restored: UpstreamRuntimeState, fallbackSessionId: string): UpstreamRuntimeState {
  const resolvedSession = resolveUpstreamRuntimeSessionState(restored.bridgeSnapshot, restored.sessionId || fallbackSessionId)

  return {
    ...restored,
    sessionId: resolvedSession.sessionId,
    phase: restored.exportUrl ? 'running' : 'ready',
    bridgeState: (restored.exportUrl ? 'waiting' : restored.bridgeState),
    bridgeSnapshot: resolvedSession.bridgeSnapshot,
    detail: resolvedSession.reused
      ? describeUpstreamRuntimeSession(resolvedSession.sessionId, true)
      : restored.exportUrl ? 'Bundled Godot runtime loaded.' : 'Ready.',
  }
}
