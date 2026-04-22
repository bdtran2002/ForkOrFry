import {
  BURGER_LEVEL,
  getBurgerAdjacentPosition,
  getBurgerTile,
  getBurgerRecipe,
  isBurgerBuildItem,
  isBurgerRecipeId,
  resolveBurgerRecipe,
  type BurgerCarryIngredient,
  type BurgerDirection,
  type BurgerInteractableKind,
} from './burger-level'
import {
  createBurgerActiveOrder,
  createInitialBurgerSessionState,
  seedBurgerShiftOrders,
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

function syncBurgerShiftPhase(state: BurgerSessionState): BurgerSessionState {
  if (state.activeOrders.length === 0 && state.upcomingOrders.length === 0) {
    return state.phase === 'completed' ? state : { ...state, phase: 'completed' }
  }

  return state.phase === 'completed' ? { ...state, phase: 'running' } : state
}

function hasLiveMatchingOrder(state: BurgerSessionState, recipeId: BurgerSessionState['player']['heldItem']) {
  return !!recipeId && isBurgerRecipeId(recipeId) && state.activeOrders.some((order) => order.recipeId === recipeId)
}

function isLooseBurgerItem(item: BurgerSessionState['player']['heldItem']) {
  return !!item && !isBurgerRecipeId(item) && !isBurgerBuildItem(item)
}

function getBoardItem(state: BurgerSessionState) {
  return state.stations.board.item ?? (state.stations.board.items.length > 0 ? { kind: 'partial-burger' as const, ingredients: state.stations.board.items } : null)
}

function getCounterItem(state: BurgerSessionState) {
  return state.stations.counter.item ?? state.stations.counter.finishedBurger
}

function promoteEligibleOrders(state: BurgerSessionState) {
  if (state.upcomingOrders.length === 0 || state.activeOrders.length >= BURGER_LEVEL.activeOrderLimit) {
    return syncBurgerShiftPhase(state)
  }

  const activeOrders = [...state.activeOrders]
  const upcomingOrders = [...state.upcomingOrders]
  const promotedIds: string[] = []

  while (upcomingOrders.length > 0 && activeOrders.length < BURGER_LEVEL.activeOrderLimit) {
    const nextOrderDefinition = upcomingOrders[0]
    if (nextOrderDefinition.releaseTick > state.tick) break

    upcomingOrders.shift()
    activeOrders.push(createBurgerActiveOrder(nextOrderDefinition))
    promotedIds.push(nextOrderDefinition.id)
  }

  const nextState = syncBurgerShiftPhase({ ...state, activeOrders, upcomingOrders })
  return promotedIds.length > 0
    ? appendLog(nextState, `${promotedIds.join(', ')} ${promotedIds.length === 1 ? 'is' : 'are'} now live.`)
    : nextState
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

  next = promoteEligibleOrders(next)

  if (next.activeOrders.length === 0) return next

  const decremented = next.activeOrders.map((order) => ({ ...order, remainingTicks: Math.max(order.remainingTicks - 1, 0) }))
  const expiredOrders = decremented.filter((order) => order.remainingTicks === 0)
  const liveOrders = decremented.filter((order) => order.remainingTicks > 0)

  if (expiredOrders.length === 0) {
    return { ...next, activeOrders: decremented }
  }

  let finalState: BurgerSessionState = { ...next, activeOrders: liveOrders }
  for (const expiredOrder of expiredOrders) {
    finalState = {
      ...finalState,
      shift: {
        ...finalState.shift,
        failedCount: finalState.shift.failedCount + 1,
        completedOrders: [...finalState.shift.completedOrders, expiredOrder.id],
      },
    }
    finalState = promoteEligibleOrders(finalState)
    finalState = appendLog(
      finalState,
      finalState.phase === 'completed'
        ? `${expiredOrder.id} timed out. Burger shift complete.`
        : `${expiredOrder.id} timed out.`,
    )
  }

  return syncBurgerShiftPhase(finalState)
}

function resolveInteract(state: BurgerSessionState) {
  if (state.phase !== 'running') return state

  if (state.activeOrders.length === 0 && state.upcomingOrders.length === 0) {
    return appendLog(
      state,
      'The burger shift is already finished.',
    )
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
      const boardItem = getBoardItem(state)

      if (heldItem && (isLooseBurgerItem(heldItem) || isBurgerBuildItem(heldItem))) {
        if (!boardItem) {
          nextState = appendLog({
            ...state,
            player: { ...state.player, heldItem: null },
            stations: { ...state.stations, board: { items: isBurgerBuildItem(heldItem) ? heldItem.ingredients : [heldItem] as BurgerCarryIngredient[], item: isBurgerBuildItem(heldItem) ? heldItem : { kind: 'partial-burger', ingredients: [heldItem] as BurgerCarryIngredient[] } } },
          }, isBurgerBuildItem(heldItem) ? 'Placed a partial burger on the board.' : `Started a partial burger on the board with ${heldItem}.`)
          break
        }

        if (isBurgerBuildItem(boardItem)) {
          if (isBurgerBuildItem(heldItem)) {
            nextState = appendLog(state, 'The board already has a partial burger.')
            break
          }
          const ingredients = [...boardItem.ingredients, heldItem] as BurgerCarryIngredient[]
          const recipeId = resolveBurgerRecipe(ingredients)
          nextState = appendLog({
            ...state,
            player: { ...state.player, heldItem: null },
            stations: { ...state.stations, board: { items: ingredients, item: recipeId ?? { kind: 'partial-burger', ingredients } } },
          }, recipeId ? `Completed ${getBurgerRecipe(recipeId).label} on the board.` : `Added ${heldItem} to the partial burger.`)
          break
        }
      }

      if (!heldItem && boardItem) {
        nextState = appendLog({
          ...state,
          player: { ...state.player, heldItem: boardItem },
          stations: { ...state.stations, board: { items: [], item: null } },
        }, isBurgerBuildItem(boardItem) ? 'Picked up a partial burger from the board.' : isBurgerRecipeId(boardItem) ? `Picked up ${getBurgerRecipe(boardItem).label} from the board.` : `Picked up ${boardItem} from the board.`)
        break
      }

      if (heldItem && isBurgerRecipeId(heldItem)) {
        nextState = appendLog(state, 'The board only accepts loose ingredients.')
        break
      }

      nextState = appendLog(state, boardItem ? 'The board is already occupied.' : 'Nothing can be assembled here right now.')
      break
    }
    case 'counter': {
      const counterItem = getCounterItem(state)
      const matchingOrderIndex = state.activeOrders.findIndex((order) => heldItem && isBurgerRecipeId(heldItem) && order.recipeId === heldItem)
      if (heldItem && isBurgerRecipeId(heldItem) && matchingOrderIndex >= 0) {
        const completedOrder = state.activeOrders[matchingOrderIndex]
        const remainingActiveOrders = state.activeOrders.filter((_, index) => index !== matchingOrderIndex)
        nextState = appendLog(
          promoteEligibleOrders({
            ...state,
            score: state.score + 1,
            shift: {
              ...state.shift,
              servedCount: state.shift.servedCount + 1,
              completedOrders: [...state.shift.completedOrders, completedOrder.id],
            },
            activeOrders: remainingActiveOrders,
            player: { ...state.player, heldItem: null },
          }),
          remainingActiveOrders.length === 0 && state.upcomingOrders.length === 0
            ? `Served ${completedOrder.id}. Burger shift complete.`
            : `Served ${completedOrder.id}.`,
        )
        break
      }

      if (heldItem && (isBurgerBuildItem(heldItem) || !hasLiveMatchingOrder(state, heldItem)) && !counterItem) {
        nextState = appendLog({
          ...state,
          player: { ...state.player, heldItem: null },
          stations: { ...state.stations, counter: { finishedBurger: heldItem, item: heldItem } },
        }, isBurgerBuildItem(heldItem)
          ? 'Staged a partial burger on the counter.'
          : isBurgerRecipeId(heldItem)
            ? `Staged ${getBurgerRecipe(heldItem).label} on the counter.`
            : `Staged ${heldItem} on the counter.`)
        break
      }

      if (heldItem && isBurgerRecipeId(heldItem) && !hasLiveMatchingOrder(state, heldItem)) {
        nextState = appendLog(state, state.activeOrders.length > 0 ? `Counter rejected ${getBurgerRecipe(heldItem).label}. Need ${getBurgerRecipe(state.activeOrders[0].recipeId).label}.` : `No live ticket matches ${getBurgerRecipe(heldItem).label} right now.`)
        break
      }

      if (!heldItem && counterItem) {
        nextState = appendLog(
          {
            ...state,
            player: { ...state.player, heldItem: counterItem },
            stations: { ...state.stations, counter: { finishedBurger: null, item: null } },
          },
          isBurgerBuildItem(counterItem) ? 'Picked up a partial burger from the counter.' : isBurgerRecipeId(counterItem) ? `Picked up ${getBurgerRecipe(counterItem).label} from the counter.` : `Picked up ${counterItem} from the counter.`,
        )
        break
      }

      nextState = appendLog(state, counterItem ? 'The counter is already staging something.' : 'The counter needs a burger to stage.')
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
      return syncBurgerShiftPhase({
        ...booted,
        phase: 'running',
      })
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
      const seeded = seedBurgerShiftOrders(0)
      return { ...reset, ...seeded, phase: 'running', log: ['Reset the local burger shift.'] }
    }
  }
}
