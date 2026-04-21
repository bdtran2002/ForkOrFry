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

function advanceKitchenTick(state: BurgerSessionState) {
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

  if (next.activeOrders.length === 0) return next

  const decremented = next.activeOrders.map((order) => ({ ...order, remainingTicks: Math.max(order.remainingTicks - 1, 0) }))
  const expiredOrders = decremented.filter((order) => order.remainingTicks === 0)
  const liveOrders = decremented.filter((order) => order.remainingTicks > 0)

  if (expiredOrders.length === 0) {
    return { ...next, activeOrders: decremented }
  }

  let finalState: BurgerSessionState = { ...next, activeOrders: liveOrders }
  for (const expiredOrder of expiredOrders) {
    const [nextOrderDefinition, ...restUpcoming] = finalState.upcomingOrders
    const nextOrder = nextOrderDefinition ? createBurgerActiveOrder(nextOrderDefinition) : null
    finalState = {
      ...finalState,
      score: finalState.score,
      shift: {
        ...finalState.shift,
        failedCount: finalState.shift.failedCount + 1,
        completedOrders: [...finalState.shift.completedOrders, expiredOrder.id],
      },
      activeOrders: nextOrder ? [...finalState.activeOrders, nextOrder] : finalState.activeOrders,
      upcomingOrders: restUpcoming,
      phase: finalState.activeOrders.length + (nextOrder ? 1 : 0) > 0 || restUpcoming.length > 0 ? 'running' : 'completed',
    }
    finalState = appendLog(
      finalState,
      nextOrder
        ? `${expiredOrder.id} timed out. ${nextOrder.id} is now live.`
        : `${expiredOrder.id} timed out. Burger shift complete.`,
    )
  }

  return finalState
}

function resolveInteract(state: BurgerSessionState) {
  if (state.phase !== 'running') return state

  if (state.activeOrders.length === 0) {
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
      const matchingOrderIndex = state.activeOrders.findIndex((order) => heldItem && isBurgerRecipeId(heldItem) && order.recipeId === heldItem)
      if (heldItem && isBurgerRecipeId(heldItem) && matchingOrderIndex >= 0) {
        const completedOrder = state.activeOrders[matchingOrderIndex]
        const remainingActiveOrders = state.activeOrders.filter((_, index) => index !== matchingOrderIndex)
        const [nextOrderDefinition, ...upcomingOrders] = state.upcomingOrders
        const nextOrder = nextOrderDefinition ? createBurgerActiveOrder(nextOrderDefinition) : null
        nextState = appendLog(
          {
            ...state,
            score: state.score + 1,
            shift: {
              ...state.shift,
              servedCount: state.shift.servedCount + 1,
              completedOrders: [...state.shift.completedOrders, completedOrder.id],
            },
            activeOrders: nextOrder ? [...remainingActiveOrders, nextOrder] : remainingActiveOrders,
            upcomingOrders,
            player: { ...state.player, heldItem: null },
            phase: remainingActiveOrders.length > 0 || upcomingOrders.length > 0 || nextOrder ? 'running' : 'completed',
          },
          nextOrder
            ? `Served ${completedOrder.id}. ${nextOrder.id} is now live.`
            : `Served ${completedOrder.id}. Burger shift complete.`,
        )
        break
      }

      if (heldItem && isBurgerRecipeId(heldItem) && state.activeOrders.length > 0) {
        nextState = appendLog(
          {
            ...state,
            player: { ...state.player, heldItem: null },
          },
          `Counter rejected ${getBurgerRecipe(heldItem).label}. Need ${getBurgerRecipe(state.activeOrders[0].recipeId).label}.`,
        )
        break
      }

      nextState = appendLog(state, 'The counter needs a finished burger.')
      break
    }
    default:
      nextState = appendLog(state, 'There is nothing to interact with here.')
  }

  return advanceKitchenTick(nextState)
}

export function reduceBurgerSession(state: BurgerSessionState, action: BurgerSessionAction): BurgerSessionState {
  switch (action.type) {
    case 'boot': {
      const booted = action.checkpoint ? cloneSessionState(action.checkpoint) : createInitialBurgerSessionState()
      return {
        ...booted,
        phase: booted.phase === 'completed' || booted.activeOrders.length === 0 ? 'completed' : 'running',
      }
    }
    case 'tick':
      return advanceKitchenTick(state)
    case 'move': {
      if (state.phase !== 'running') return state
      const destination = getBurgerAdjacentPosition(state.player.position, action.direction)
      const tile = getBurgerTile(destination)
      if (!tile?.walkable) {
        return advanceKitchenTick(appendLog({ ...state, player: { ...state.player, facing: action.direction } }, 'That path is blocked.'))
      }
      return advanceKitchenTick(appendLog({ ...state, player: { ...state.player, position: destination, facing: action.direction } }, `Moved ${action.direction}.`))
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
