export const UPSTREAM_RUNTIME_SAVE_VERSION = 1 as const

export type UpstreamRuntimeExportState = 'unknown' | 'missing' | 'ready' | 'loaded' | 'error'

export interface UpstreamRuntimeState {
  saveVersion: typeof UPSTREAM_RUNTIME_SAVE_VERSION
  sessionId: string
  phase: 'booting' | 'running' | 'paused' | 'ready'
  exportState: UpstreamRuntimeExportState
  detail: string
  exportUrl: string | null
  lastCheckpointReason: string | null
}

export function createInitialUpstreamRuntimeState(): UpstreamRuntimeState {
  return {
    saveVersion: UPSTREAM_RUNTIME_SAVE_VERSION,
    sessionId: '',
    phase: 'booting',
    exportState: 'unknown',
    detail: 'Waiting for host boot…',
    exportUrl: null,
    lastCheckpointReason: null,
  }
}
