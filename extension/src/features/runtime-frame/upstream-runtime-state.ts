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
    bridgeSnapshot: {
      acknowledgedSessionId: null,
      acknowledgedPacketCount: 0,
      lastError: null,
    },
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
