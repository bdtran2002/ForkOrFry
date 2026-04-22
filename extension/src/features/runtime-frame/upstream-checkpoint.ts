import {
  RUNTIME_PROTOCOL_VERSION,
  type RuntimeCheckpointEnvelope,
} from '../runtime-host/contract'
import {
  UPSTREAM_RUNTIME_SAVE_VERSION,
  createInitialUpstreamRuntimeState,
  summarizeUpstreamRuntimeGameplayPackets,
  trimUpstreamRuntimeGameplayPackets,
  type UpstreamRuntimeState,
} from './upstream-runtime-state'
import type { UpstreamAuthoritySnapshot } from './local-authority'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isAuthoritySnapshot(value: unknown): value is UpstreamAuthoritySnapshot {
  return (
    isRecord(value)
    && typeof value.playerId === 'number'
    && Array.isArray(value.position)
    && value.position.length === 2
    && value.position.every((part) => typeof part === 'number')
    && Array.isArray(value.direction)
    && value.direction.length === 2
    && value.direction.every((part) => typeof part === 'number')
    && typeof value.rotation === 'number'
    && typeof value.boost === 'boolean'
    && Array.isArray(value.hands)
    && value.hands.every((item) => item === null || typeof item === 'number')
    && isRecord(value.tileItems)
    && Object.values(value.tileItems).every((item) => item === null || typeof item === 'number')
    && isRecord(value.progressTiles)
    && Object.values(value.progressTiles).every((progress) => (
      isRecord(progress)
      && typeof progress.position === 'number'
      && typeof progress.speed === 'number'
      && typeof progress.baseSpeed === 'number'
      && typeof progress.warn === 'boolean'
      && Array.isArray(progress.players)
      && progress.players.every((player) => typeof player === 'number')
      && typeof progress.hand === 'number'
      && (progress.handOutput === null || typeof progress.handOutput === 'number')
      && (progress.tileOutput === null || typeof progress.tileOutput === 'number')
    ))
    && (
      value.interaction === null
      || (
        isRecord(value.interaction)
        && typeof value.interaction.hand === 'number'
        && Array.isArray(value.interaction.tile)
        && value.interaction.tile.length === 2
        && value.interaction.tile.every((part) => typeof part === 'number')
      )
    )
  )
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
    && isRecord(value.bridgeSnapshot)
    && (value.bridgeSnapshot.acknowledgedSessionId === null || typeof value.bridgeSnapshot.acknowledgedSessionId === 'string')
    && typeof value.bridgeSnapshot.acknowledgedPacketCount === 'number'
    && (value.bridgeSnapshot.lastError === null || typeof value.bridgeSnapshot.lastError === 'string')
    && (value.authoritySnapshot === null || isAuthoritySnapshot(value.authoritySnapshot))
    && Array.isArray(value.gameplayPackets)
    && (
      value.gameplayPacketSummary === undefined
      || (
        isRecord(value.gameplayPacketSummary)
        && typeof value.gameplayPacketSummary.totalCount === 'number'
        && (value.gameplayPacketSummary.lastAction === null || typeof value.gameplayPacketSummary.lastAction === 'string')
        && isRecord(value.gameplayPacketSummary.actionCounts)
      )
    )
  )
}

export function restoreUpstreamRuntimeCheckpoint(
  runtimeId: string,
  checkpoint: RuntimeCheckpointEnvelope | null,
) {
  if (!checkpoint || checkpoint.runtimeId !== runtimeId || !isUpstreamRuntimeState(checkpoint.state)) {
    return createInitialUpstreamRuntimeState()
  }

  const initialState = createInitialUpstreamRuntimeState()
  const gameplayPackets = trimUpstreamRuntimeGameplayPackets(checkpoint.state.gameplayPackets)
  const gameplayPacketSummary = summarizeUpstreamRuntimeGameplayPackets(gameplayPackets)

  return {
    ...initialState,
    ...checkpoint.state,
    lastCheckpointReason: null,
    gameplayPackets,
    gameplayPacketSummary,
  }
}

export function createUpstreamRuntimeCheckpoint(runtimeId: string, state: UpstreamRuntimeState): RuntimeCheckpointEnvelope<UpstreamRuntimeState> {
  return {
    version: RUNTIME_PROTOCOL_VERSION,
    runtimeId,
    updatedAt: Date.now(),
    state,
  }
}
