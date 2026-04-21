import { BURGER_LEVEL, type BurgerCarryItem, type BurgerStationId } from './burger-level'
import { createInitialBurgerSessionState, type BurgerSessionState } from './burger-session-state'

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
  if (state.inventory.patty > 0 && state.stations.grill.patty === 'empty' && !state.stations.board.patty) return 'patty'
  if (state.inventory.bun > 0 && !state.stations.board.bun) return 'bun'
  if (state.inventory.cheese > 0 && !state.stations.board.cheese) return 'cheese'

  const fallback = (['patty', 'bun', 'cheese'] as const).find((item) => state.inventory[item] > 0)
  return fallback ?? null
}

function resolveInteract(state: BurgerSessionState) {
  if (state.phase !== 'running') return state

  if (state.activeOrder.status !== 'waiting') {
    return appendLog(state, 'The burger order loop is already finished.')
  }

  const heldItem = state.player.heldItem

  switch (state.player.location) {
    case 'storage': {
      if (heldItem) return appendLog(state, 'Hands are full. Move to a station before taking more ingredients.')
      const nextItem = chooseStorageItem(state)
      if (!nextItem || nextItem === 'cooked-patty' || nextItem === 'burger') {
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
      if (heldItem === 'bun' && !state.stations.board.bun) {
        return appendLog(
          {
            ...state,
            player: { ...state.player, heldItem: null },
            stations: {
              ...state.stations,
              board: { ...state.stations.board, bun: true },
            },
          },
          'Placed the bun on the board.',
        )
      }

      if (heldItem === 'cooked-patty' && !state.stations.board.patty) {
        return appendLog(
          {
            ...state,
            player: { ...state.player, heldItem: null },
            stations: {
              ...state.stations,
              board: { ...state.stations.board, patty: true },
            },
          },
          'Placed the cooked patty on the bun.',
        )
      }

      if (heldItem === 'cheese' && !state.stations.board.cheese) {
        return appendLog(
          {
            ...state,
            player: { ...state.player, heldItem: null },
            stations: {
              ...state.stations,
              board: { ...state.stations.board, cheese: true },
            },
          },
          'Added cheese to the burger stack.',
        )
      }

      if (!heldItem && state.stations.board.bun && state.stations.board.patty && state.stations.board.cheese) {
        return appendLog(
          {
            ...state,
            player: { ...state.player, heldItem: 'burger' },
            stations: {
              ...state.stations,
              board: { bun: false, patty: false, cheese: false },
            },
          },
          'Assembled the finished burger.',
        )
      }

      return appendLog(state, heldItem ? 'That item does not belong on the board yet.' : 'The board is waiting for more ingredients.')
    }
    case 'counter': {
      if (heldItem === 'burger') {
        return appendLog(
          {
            ...state,
            phase: 'completed',
            score: state.score + 1,
            player: { ...state.player, heldItem: null },
            activeOrder: { ...state.activeOrder, status: 'served', remainingTicks: state.activeOrder.remainingTicks },
          },
          'Served the burger order. Session complete.',
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

  if (next.activeOrder.status !== 'waiting') {
    return next
  }

  const remainingTicks = Math.max(next.activeOrder.remainingTicks - 1, 0)
  next = {
    ...next,
    activeOrder: { ...next.activeOrder, remainingTicks },
  }

  if (remainingTicks === 0) {
    return appendLog(
      {
        ...next,
        phase: 'completed',
        activeOrder: { ...next.activeOrder, status: 'failed', remainingTicks },
      },
      'The burger order timed out before service.',
    )
  }

  return next
}

export function reduceBurgerSession(state: BurgerSessionState, action: BurgerSessionAction): BurgerSessionState {
  switch (action.type) {
    case 'boot': {
      const booted = action.checkpoint ? cloneSessionState(action.checkpoint) : createInitialBurgerSessionState()
      return {
        ...booted,
        phase: booted.phase === 'completed' ? 'completed' : 'running',
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
      return { ...reset, phase: 'running', log: ['Reset the local burger session.'] }
    }
  }
}
