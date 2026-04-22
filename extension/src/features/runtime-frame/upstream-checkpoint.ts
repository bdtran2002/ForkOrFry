import {
  RUNTIME_PROTOCOL_VERSION,
  type RuntimeCheckpointEnvelope,
} from '../runtime-host/contract'
import {
  UPSTREAM_RUNTIME_SAVE_VERSION,
  createInitialUpstreamRuntimeState,
  type UpstreamRuntimeState,
} from './upstream-runtime-state'
import { isUpstreamBootstrapPayload } from './upstream-bridge'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isNullableString(value: unknown) {
  return value === null || typeof value === 'string'
}

function isGameplayPacket(value: unknown): value is UpstreamRuntimeState['gameplayPackets'][number] {
  return (
    isRecord(value)
    && typeof value.action === 'string'
    && isRecord(value.payload)
    && typeof value.receivedAt === 'string'
  )
}

function createGameplayPacketSummary(packets: UpstreamRuntimeState['gameplayPackets']) {
  const actionCounts: Record<string, number> = {}
  let lastAction: string | null = null

  for (const packet of packets) {
    if (!isGameplayPacket(packet)) continue
    actionCounts[packet.action] = (actionCounts[packet.action] ?? 0) + 1
    lastAction = packet.action
  }

  return {
    totalCount: packets.length,
    lastAction,
    actionCounts,
  }
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
    && (value.bridgeSnapshot.payload === null || isUpstreamBootstrapPayload(value.bridgeSnapshot.payload))
    && (value.bridgeSnapshot.acknowledgedSessionId === null || typeof value.bridgeSnapshot.acknowledgedSessionId === 'string')
    && typeof value.bridgeSnapshot.acknowledgedPacketCount === 'number'
    && (value.bridgeSnapshot.lastError === null || typeof value.bridgeSnapshot.lastError === 'string')
    && (
      value.godotBridgeSnapshot === undefined
      || (
        isRecord(value.godotBridgeSnapshot)
        && isNullableString(value.godotBridgeSnapshot.entryState)
        && isNullableString(value.godotBridgeSnapshot.lastUpdate)
        && isNullableString(value.godotBridgeSnapshot.updatedAt)
      )
    )
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
  const gameplayPacketSummary = createGameplayPacketSummary(checkpoint.state.gameplayPackets)

  return {
    ...initialState,
    ...checkpoint.state,
    lastCheckpointReason: null,
    godotBridgeSnapshot: checkpoint.state.godotBridgeSnapshot ?? initialState.godotBridgeSnapshot,
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
