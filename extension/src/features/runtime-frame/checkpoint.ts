import {
  RUNTIME_PROTOCOL_VERSION,
  type RuntimeCheckpointEnvelope,
} from '../runtime-host/contract'
import {
  BURGER_SESSION_SAVE_VERSION,
  createInitialBurgerSessionState,
  type BurgerSessionState,
} from './burger-session-state'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isBurgerSessionState(value: unknown): value is BurgerSessionState {
  const position = isRecord(value) && isRecord(value.player) && isRecord(value.player.position) ? value.player.position : null

  return (
    isRecord(value) &&
    value.saveVersion === BURGER_SESSION_SAVE_VERSION &&
    value.levelId === 'burger' &&
    typeof value.tick === 'number' &&
    typeof value.score === 'number' &&
    Array.isArray(value.log) &&
    isRecord(value.shift) &&
    typeof value.shift.totalOrders === 'number' &&
    typeof value.shift.servedCount === 'number' &&
    typeof value.shift.failedCount === 'number' &&
    Array.isArray(value.shift.completedOrders) &&
    isRecord(value.stations) &&
    isRecord(value.stations.board) &&
    Array.isArray(value.stations.board.items) &&
    Array.isArray(value.upcomingOrders) &&
    isRecord(value.player) &&
    isRecord(position) &&
    typeof position.x === 'number' &&
    typeof position.y === 'number' &&
    (value.player.facing === 'up' || value.player.facing === 'down' || value.player.facing === 'left' || value.player.facing === 'right') &&
    ('currentOrder' in value ? value.currentOrder === null || isRecord(value.currentOrder) : false)
  )
}

export function restoreBurgerSessionCheckpoint(
  runtimeId: string,
  checkpoint: RuntimeCheckpointEnvelope | null,
) {
  if (!checkpoint || checkpoint.runtimeId !== runtimeId || !isBurgerSessionState(checkpoint.state)) {
    return createInitialBurgerSessionState()
  }

  return checkpoint.state
}

export function createBurgerSessionCheckpoint(runtimeId: string, state: BurgerSessionState): RuntimeCheckpointEnvelope<BurgerSessionState> {
  return {
    version: RUNTIME_PROTOCOL_VERSION,
    runtimeId,
    updatedAt: Date.now(),
    state,
  }
}
