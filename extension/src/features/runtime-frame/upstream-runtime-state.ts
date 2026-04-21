export const UPSTREAM_RUNTIME_SAVE_VERSION = 1 as const

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
  }
}
