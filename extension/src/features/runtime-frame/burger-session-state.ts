import { BURGER_LEVEL, type BurgerCarryItem, type BurgerIngredient, type BurgerStationId } from './burger-level'

export const BURGER_SESSION_SAVE_VERSION = 1 as const

export type BurgerSessionPhase = 'booting' | 'running' | 'paused' | 'completed'
export type BurgerOrderStatus = 'waiting' | 'served' | 'failed'

export interface BurgerSessionState {
  saveVersion: typeof BURGER_SESSION_SAVE_VERSION
  levelId: typeof BURGER_LEVEL.id
  phase: BurgerSessionPhase
  tick: number
  score: number
  inventory: Record<BurgerIngredient, number>
  stations: {
    grill: {
      patty: 'empty' | 'cooking' | 'cooked'
      progressTicks: number
    }
    board: {
      bun: boolean
      patty: boolean
      cheese: boolean
    }
  }
  activeOrder: {
    id: string
    recipe: 'burger'
    status: BurgerOrderStatus
    remainingTicks: number
  }
  player: {
    location: BurgerStationId
    heldItem: BurgerCarryItem | null
  }
  log: string[]
}

export function createInitialBurgerSessionState(): BurgerSessionState {
  return {
    saveVersion: BURGER_SESSION_SAVE_VERSION,
    levelId: BURGER_LEVEL.id,
    phase: 'booting',
    tick: 0,
    score: 0,
    inventory: { ...BURGER_LEVEL.pantry },
    stations: {
      grill: {
        patty: 'empty',
        progressTicks: 0,
      },
      board: {
        bun: false,
        patty: false,
        cheese: false,
      },
    },
    activeOrder: {
      id: 'burger-order-1',
      recipe: 'burger',
      status: 'waiting',
      remainingTicks: BURGER_LEVEL.orderDurationTicks,
    },
    player: {
      location: 'storage',
      heldItem: null,
    },
    log: ['Booted the local burger session.'],
  }
}
