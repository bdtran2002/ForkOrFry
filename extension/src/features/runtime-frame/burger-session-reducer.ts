import {
  BURGER_LEVEL,
  getBurgerAdjacentPosition,
  getBurgerTile,
  getBurgerRecipe,
  isBurgerRecipeId,
  resolveBurgerRecipe,
  type BurgerDirection,
  type BurgerInteractableKind,
} from './burger-level'
import {
  createBurgerActiveOrder,
  createInitialBurgerSessionState,
  type BurgerSessionState,
} from './burger-session-state'

export type BurgerSessionAction =
  | { type: 'boot'; checkpoint: BurgerSessionState | null }
  | { type: 'tick' }
  | { type: 'move'; direction: BurgerDirection }
  | { type: 'interact' }
  | { type: 'pause' }
  | { type: 'resume' }
  | { type: 'reset' }

function cloneSessionState(state: BurgerSessionState) {
  if (typeof globalThis.structuredClone === 'function') {
    return globalThis.structuredClone(state)
  }

  return JSON.parse(JSON.stringify(state)) as BurgerSessionState
}

function appendLog(state: BurgerSessionState, message: string) {
  return {
    ...state,
    log: [...state.log, message].slice(-8),
  }
}

function resetStationsAndPlayer(state: BurgerSessionState) {
  return {
    ...state,
    stations: {
      grill: { patty: 'empty' as const, progressTicks: 0 },
      board: { items: [] },
    },
    player: {
      position: BURGER_LEVEL.spawn,
      facing: 'up' as const,
      heldItem: null,
    },
  }
}

function getActiveInteractable(state: BurgerSessionState) {
  const currentTile = getBurgerTile(state.player.position)
  if (currentTile?.interactable) return currentTile
  return getBurgerTile(getBurgerAdjacentPosition(state.player.position, state.player.facing))
}

function getInteractableIngredient(kind: BurgerInteractableKind): 'bun' | 'patty' | 'cheese' {
  switch (kind) {
    case 'bun-crate': return 'bun'
    case 'patty-crate': return 'patty'
    case 'cheese-crate': return 'cheese'
    default: return 'bun'
  }
}

function completeCurrentOrder(state: BurgerSessionState, outcome: 'served' | 'failed') {
  const currentOrder = state.currentOrder
  if (!currentOrder) {
    return appendLog(state, 'The burger shift is already complete.')
  }

  const [nextOrderDefinition, ...upcomingOrders] = state.upcomingOrders
  const nextOrder = nextOrderDefinition ? createBurgerActiveOrder(nextOrderDefinition) : null
  const servedCount = state.shift.servedCount + (outcome === 'served' ? 1 : 0)
  const failedCount = state.shift.failedCount + (outcome === 'failed' ? 1 : 0)
  const finished = resetStationsAndPlayer({
    ...state,
    score: state.score + (outcome === 'served' ? 1 : 0),
    shift: {
      ...state.shift,
      servedCount,
      failedCount,
      completedOrders: [...state.shift.completedOrders, currentOrder.id],
    },
    currentOrder: nextOrder,
    upcomingOrders,
    phase: nextOrder ? 'running' : 'completed',
  })

  return appendLog(
    finished,
    outcome === 'served'
      ? nextOrder
        ? `Served ${currentOrder.id}. ${nextOrder.id} is now live.`
        : `Served ${currentOrder.id}. Burger shift complete.`
      : nextOrder
        ? `${currentOrder.id} timed out. ${nextOrder.id} is now live.`
        : `${currentOrder.id} timed out. Burger shift complete.`,
  )
}

function advanceKitchenTick(state: BurgerSessionState, timedOrderId: string | null = state.currentOrder?.id ?? null) {
  if (state.phase !== 'running') return state

  let next: BurgerSessionState = {
    ...state,
    tick: state.tick + 1,
  }

  if (next.stations.grill.patty === 'cooking' || next.stations.grill.patty === 'cooked') {
    const progressTicks = next.stations.grill.progressTicks + 1
    const cooked = progressTicks >= BURGER_LEVEL.grillCookTicks
    const burnt = progressTicks >= BURGER_LEVEL.grillBurnTicks
    next = appendLog(
      {
        ...next,
        stations: {
          ...next.stations,
          grill: {
            patty: burnt ? 'burnt' : cooked ? 'cooked' : 'cooking',
            progressTicks,
          },
        },
      },
      burnt
        ? 'The patty burned on the grill.'
        : cooked
          ? 'The patty finished cooking.'
          : `The grill advanced to tick ${progressTicks}.`,
    )
  }

  if (!timedOrderId || !next.currentOrder || next.currentOrder.id !== timedOrderId) {
    return next
  }

  const remainingTicks = Math.max(next.currentOrder.remainingTicks - 1, 0)
  next = {
    ...next,
    currentOrder: { ...next.currentOrder, remainingTicks },
  }

  if (remainingTicks === 0) {
    return completeCurrentOrder(next, 'failed')
  }

  return next
}

function resolveInteract(state: BurgerSessionState) {
  if (state.phase !== 'running') return state

  if (!state.currentOrder) {
    return appendLog(state, 'The burger shift is already finished.')
  }

  const heldItem = state.player.heldItem

  const activeInteractable = getActiveInteractable(state)

  let nextState: BurgerSessionState

  switch (activeInteractable?.interactable) {
    case 'bun-crate':
    case 'patty-crate':
    case 'cheese-crate': {
      const ingredient = getInteractableIngredient(activeInteractable.interactable)
      if (heldItem) {
        nextState = appendLog(state, 'Hands are full. Put that down first.')
        break
      }
      if (state.inventory[ingredient] <= 0) {
        nextState = appendLog(state, `The ${ingredient} crate is empty.`)
        break
      }
      nextState = appendLog({ ...state, inventory: { ...state.inventory, [ingredient]: state.inventory[ingredient] - 1 }, player: { ...state.player, heldItem: ingredient } }, `Picked up ${ingredient} from the crate.`)
      break
    }
    case 'grill': {
      if (heldItem === 'patty' && state.stations.grill.patty === 'empty') {
        nextState = appendLog(
          {
            ...state,
            player: { ...state.player, heldItem: null },
            stations: {
              ...state.stations,
              grill: { patty: 'cooking', progressTicks: 0 },
            },
          },
          'Dropped a patty onto the grill.',
        )
        break
      }

      if (!heldItem && state.stations.grill.patty === 'cooked') {
        nextState = appendLog(
          {
            ...state,
            player: { ...state.player, heldItem: 'cooked-patty' },
            stations: {
              ...state.stations,
              grill: { patty: 'empty', progressTicks: 0 },
            },
          },
          'Picked up the cooked patty.',
        )
        break
      }

      if (!heldItem && state.stations.grill.patty === 'burnt') {
        nextState = appendLog(
          {
            ...state,
            stations: {
              ...state.stations,
              grill: { patty: 'empty', progressTicks: 0 },
            },
          },
          'Cleared the burnt patty from the grill.',
        )
        break
      }

      nextState = appendLog(state, heldItem ? 'The grill cannot use that item right now.' : 'Nothing is ready on the grill yet.')
      break
    }
    case 'board': {
      if (heldItem && !isBurgerRecipeId(heldItem) && !state.stations.board.items.includes(heldItem)) {
        nextState = appendLog(
          {
            ...state,
            player: { ...state.player, heldItem: null },
            stations: {
              ...state.stations,
              board: { items: [...state.stations.board.items, heldItem] },
            },
          },
          `Placed ${heldItem} on the board.`,
        )
        break
      }

      if (heldItem && !isBurgerRecipeId(heldItem) && state.stations.board.items.includes(heldItem)) {
        nextState = appendLog(state, `${heldItem} is already on the board.`)
        break
      }

      if (heldItem && isBurgerRecipeId(heldItem)) {
        nextState = appendLog(state, 'The board only accepts loose ingredients.')
        break
      }

      const assembledRecipe = resolveBurgerRecipe(state.stations.board.items)
      if (!heldItem && assembledRecipe) {
        nextState = appendLog(
          {
            ...state,
            player: { ...state.player, heldItem: assembledRecipe },
            stations: {
              ...state.stations,
              board: { items: [] },
            },
          },
          `Assembled ${getBurgerRecipe(assembledRecipe).label}.`,
        )
        break
      }

      nextState = appendLog(state, heldItem ? 'That item does not belong on the board yet.' : 'The board recipe is incomplete or mismatched.')
      break
    }
    case 'counter': {
      if (heldItem && isBurgerRecipeId(heldItem) && state.currentOrder && heldItem === state.currentOrder.recipeId) {
        nextState = completeCurrentOrder(state, 'served')
        break
      }

      if (heldItem && isBurgerRecipeId(heldItem) && state.currentOrder) {
        nextState = appendLog(
          {
            ...state,
            player: { ...state.player, heldItem: null },
          },
          `Counter rejected ${getBurgerRecipe(heldItem).label}. Need ${getBurgerRecipe(state.currentOrder.recipeId).label}.`,
        )
        break
      }

      nextState = appendLog(state, 'The counter needs a finished burger.')
      break
    }
    default:
      nextState = appendLog(state, 'There is nothing to interact with here.')
  }

  return advanceKitchenTick(nextState, state.currentOrder?.id ?? null)
}

export function reduceBurgerSession(state: BurgerSessionState, action: BurgerSessionAction): BurgerSessionState {
  switch (action.type) {
    case 'boot': {
      const booted = action.checkpoint ? cloneSessionState(action.checkpoint) : createInitialBurgerSessionState()
      return {
        ...booted,
        phase: booted.phase === 'completed' || booted.currentOrder === null ? 'completed' : 'running',
      }
    }
    case 'tick':
      return advanceKitchenTick(state)
    case 'move': {
      if (state.phase !== 'running') return state
      const destination = getBurgerAdjacentPosition(state.player.position, action.direction)
      const timedOrderId = state.currentOrder?.id ?? null
      const tile = getBurgerTile(destination)
      if (!tile?.walkable) {
        return advanceKitchenTick(appendLog({ ...state, player: { ...state.player, facing: action.direction } }, 'That path is blocked.'), timedOrderId)
      }
      return advanceKitchenTick(appendLog({ ...state, player: { ...state.player, position: destination, facing: action.direction } }, `Moved ${action.direction}.`), timedOrderId)
    }
    case 'interact':
      return resolveInteract(state)
    case 'pause':
      return state.phase === 'completed' || state.phase === 'booting' ? state : { ...state, phase: 'paused' }
    case 'resume':
      return state.phase === 'completed' || state.phase === 'booting' ? state : { ...state, phase: 'running' }
    case 'reset': {
      const reset = createInitialBurgerSessionState()
      return { ...reset, phase: 'running', log: ['Reset the local burger shift.'] }
    }
  }
}
