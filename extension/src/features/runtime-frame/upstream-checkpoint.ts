import {
  RUNTIME_PROTOCOL_VERSION,
  type RuntimeCheckpointEnvelope,
} from '../runtime-host/contract'
import {
  UPSTREAM_RUNTIME_SAVE_VERSION,
  createInitialUpstreamRuntimeState,
  type UpstreamRuntimeState,
} from './upstream-runtime-state'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isUpstreamRuntimeState(value: unknown): value is UpstreamRuntimeState {
  return (
    isRecord(value)
    && value.saveVersion === UPSTREAM_RUNTIME_SAVE_VERSION
    && typeof value.sessionId === 'string'
    && (value.phase === 'booting' || value.phase === 'running' || value.phase === 'paused' || value.phase === 'ready')
    && (value.exportState === 'unknown' || value.exportState === 'missing' || value.exportState === 'ready' || value.exportState === 'loaded' || value.exportState === 'error')
    && (value.bridgeState === 'idle' || value.bridgeState === 'waiting' || value.bridgeState === 'sent' || value.bridgeState === 'acknowledged' || value.bridgeState === 'error')
    && typeof value.detail === 'string'
    && (value.exportUrl === null || typeof value.exportUrl === 'string')
    && (value.lastCheckpointReason === null || typeof value.lastCheckpointReason === 'string')
    && typeof value.bootstrapPacketCount === 'number'
  )
}

export function restoreUpstreamRuntimeCheckpoint(
  runtimeId: string,
  checkpoint: RuntimeCheckpointEnvelope | null,
) {
  if (!checkpoint || checkpoint.runtimeId !== runtimeId || !isUpstreamRuntimeState(checkpoint.state)) {
    return createInitialUpstreamRuntimeState()
  }

  return checkpoint.state
}

export function createUpstreamRuntimeCheckpoint(runtimeId: string, state: UpstreamRuntimeState): RuntimeCheckpointEnvelope<UpstreamRuntimeState> {
  return {
    version: RUNTIME_PROTOCOL_VERSION,
    runtimeId,
    updatedAt: Date.now(),
    state,
  }
}
