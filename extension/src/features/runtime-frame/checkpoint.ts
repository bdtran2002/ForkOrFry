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
    Array.isArray(value.upcomingOrders) &&
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
