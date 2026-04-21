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

function isBurgerCarryItem(value: unknown): boolean {
  return value === 'bun' || value === 'patty' || value === 'cheese' || value === 'cooked-patty' || value === 'plain-burger' || value === 'cheeseburger' || (isRecord(value) && value.kind === 'partial-burger' && Array.isArray(value.ingredients))
}

function isBurgerSessionState(value: unknown): value is BurgerSessionState {
  const position = isRecord(value) && isRecord(value.player) && isRecord(value.player.position) ? value.player.position : null
  const activeOrders = isRecord(value) && Array.isArray(value.activeOrders) ? value.activeOrders : null
  const upcomingOrders = isRecord(value) && Array.isArray(value.upcomingOrders) ? value.upcomingOrders : null

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
    Array.isArray(activeOrders) &&
    activeOrders.every((order) => isRecord(order)
      && typeof order.id === 'string'
      && (order.recipeId === 'plain-burger' || order.recipeId === 'cheeseburger')
      && typeof order.remainingTicks === 'number'
      && typeof order.durationTicks === 'number') &&
    isRecord(value.stations) &&
    isRecord(value.stations.grill) &&
    (value.stations.grill.patty === 'empty' || value.stations.grill.patty === 'cooking' || value.stations.grill.patty === 'cooked' || value.stations.grill.patty === 'burnt') &&
    typeof value.stations.grill.progressTicks === 'number' &&
    isRecord(value.stations.board) &&
    ((Array.isArray(value.stations.board.items) && value.stations.board.items.every((item) => item === 'bun' || item === 'patty' || item === 'cheese' || item === 'cooked-patty')) || value.stations.board.item === null || isBurgerCarryItem(value.stations.board.item)) &&
    isRecord(value.stations.counter) &&
    ((value.stations.counter.finishedBurger === null || isBurgerCarryItem(value.stations.counter.finishedBurger)) || value.stations.counter.item === null || isBurgerCarryItem(value.stations.counter.item)) &&
    Array.isArray(upcomingOrders) &&
    upcomingOrders.every((order) => isRecord(order)
      && typeof order.id === 'string'
      && (order.recipeId === 'plain-burger' || order.recipeId === 'cheeseburger')
      && typeof order.durationTicks === 'number'
      && typeof order.releaseTick === 'number') &&
    isRecord(value.player) &&
    isRecord(position) &&
    typeof position.x === 'number' &&
    typeof position.y === 'number' &&
    (value.player.facing === 'up' || value.player.facing === 'down' || value.player.facing === 'left' || value.player.facing === 'right') &&
    true
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
