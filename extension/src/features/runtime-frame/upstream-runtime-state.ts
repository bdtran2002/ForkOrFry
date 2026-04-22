export const UPSTREAM_RUNTIME_SAVE_VERSION = 1 as const

import type { UpstreamBridgeSnapshot, UpstreamBridgeState } from './upstream-bridge'

export type UpstreamRuntimeExportState = 'unknown' | 'missing' | 'ready' | 'loaded' | 'error'

export interface UpstreamGodotBridgeSnapshot {
  entryState: string | null
  lastUpdate: string | null
  updatedAt: string | null
}

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
  godotBridgeSnapshot: UpstreamGodotBridgeSnapshot
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
      payload: null,
      acknowledgedSessionId: null,
      acknowledgedPacketCount: 0,
      lastError: null,
    },
    godotBridgeSnapshot: {
      entryState: null,
      lastUpdate: null,
      updatedAt: null,
    },
    gameplayPackets: [],
    gameplayPacketSummary: {
      totalCount: 0,
      lastAction: null,
      actionCounts: {},
    },
  }
}
