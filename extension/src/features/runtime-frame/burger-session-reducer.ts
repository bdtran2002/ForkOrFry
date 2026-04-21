import {
  BURGER_LEVEL,
  getBurgerRecipe,
  isBurgerRecipeId,
  resolveBurgerRecipe,
  type BurgerCarryItem,
  type BurgerStationId,
} from './burger-level'
import {
  createBurgerActiveOrder,
  createInitialBurgerSessionState,
  type BurgerSessionState,
} from './burger-session-state'

export type BurgerSessionAction =
  | { type: 'boot'; checkpoint: BurgerSessionState | null }
  | { type: 'tick' }
  | { type: 'move'; location: BurgerStationId }
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

function chooseStorageItem(state: BurgerSessionState): BurgerCarryItem | null {
  const recipe = state.currentOrder ? getBurgerRecipe(state.currentOrder.recipeId) : null
  const boardItems = new Set(state.stations.board.items)

  if (state.inventory.patty > 0 && state.stations.grill.patty === 'empty' && !boardItems.has('cooked-patty')) return 'patty'

  const nextRequiredIngredient = recipe?.ingredients.find(
    (ingredient) => ingredient !== 'cooked-patty' && !boardItems.has(ingredient) && state.inventory[ingredient] > 0,
  )

  if (nextRequiredIngredient) return nextRequiredIngredient

  const fallback = (['cheese', 'bun', 'patty'] as const).find((item) => state.inventory[item] > 0)
  return fallback ?? null
}

function resetStationsAndPlayer(state: BurgerSessionState) {
  return {
    ...state,
    stations: {
      grill: { patty: 'empty' as const, progressTicks: 0 },
      board: { items: [] },
    },
    player: {
      location: 'storage' as const,
      heldItem: null,
    },
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

function resolveInteract(state: BurgerSessionState) {
  if (state.phase !== 'running') return state

  if (!state.currentOrder) {
    return appendLog(state, 'The burger shift is already finished.')
  }

  const heldItem = state.player.heldItem

  switch (state.player.location) {
    case 'storage': {
      if (heldItem) return appendLog(state, 'Hands are full. Move to a station before taking more ingredients.')
      const nextItem = chooseStorageItem(state)
      if (!nextItem || nextItem === 'cooked-patty' || isBurgerRecipeId(nextItem)) {
        return appendLog(state, 'The pantry is empty for this order.')
      }

      return appendLog(
        {
          ...state,
          inventory: { ...state.inventory, [nextItem]: state.inventory[nextItem] - 1 },
          player: { ...state.player, heldItem: nextItem },
        },
        `Picked up ${nextItem} from storage.`,
      )
    }
    case 'grill': {
      if (heldItem === 'patty' && state.stations.grill.patty === 'empty') {
        return appendLog(
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
      }

      if (!heldItem && state.stations.grill.patty === 'cooked') {
        return appendLog(
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
      }

      return appendLog(state, heldItem ? 'The grill cannot use that item right now.' : 'Nothing is ready on the grill yet.')
    }
    case 'board': {
      if (heldItem && !isBurgerRecipeId(heldItem) && !state.stations.board.items.includes(heldItem)) {
        return appendLog(
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
      }

      if (heldItem && !isBurgerRecipeId(heldItem) && state.stations.board.items.includes(heldItem)) {
        return appendLog(state, `${heldItem} is already on the board.`)
      }

      if (heldItem && isBurgerRecipeId(heldItem)) {
        return appendLog(state, 'The board only accepts loose ingredients.')
      }

      const assembledRecipe = resolveBurgerRecipe(state.stations.board.items)
      if (!heldItem && assembledRecipe) {
        return appendLog(
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
      }

      return appendLog(state, heldItem ? 'That item does not belong on the board yet.' : 'The board recipe is incomplete or mismatched.')
    }
    case 'counter': {
      if (heldItem && isBurgerRecipeId(heldItem) && state.currentOrder && heldItem === state.currentOrder.recipeId) {
        return completeCurrentOrder(state, 'served')
      }

      if (heldItem && isBurgerRecipeId(heldItem) && state.currentOrder) {
        return appendLog(
          {
            ...state,
            player: { ...state.player, heldItem: null },
          },
          `Counter rejected ${getBurgerRecipe(heldItem).label}. Need ${getBurgerRecipe(state.currentOrder.recipeId).label}.`,
        )
      }

      return appendLog(state, 'The counter needs a finished burger.')
    }
  }
}

function resolveTick(state: BurgerSessionState) {
  if (state.phase !== 'running') return state

  let next: BurgerSessionState = {
    ...state,
    tick: state.tick + 1,
  }

  if (next.stations.grill.patty === 'cooking') {
    const progressTicks = next.stations.grill.progressTicks + 1
    const cooked = progressTicks >= BURGER_LEVEL.grillCookTicks
    next = appendLog(
      {
        ...next,
        stations: {
          ...next.stations,
          grill: {
            patty: cooked ? 'cooked' : 'cooking',
            progressTicks,
          },
        },
      },
      cooked ? 'The patty finished cooking.' : `The grill advanced to tick ${progressTicks}.`,
    )
  }

  if (!next.currentOrder) {
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
      return resolveTick(state)
    case 'move':
      return state.phase === 'running'
        ? appendLog({ ...state, player: { ...state.player, location: action.location } }, `Moved to ${action.location}.`)
        : state
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
