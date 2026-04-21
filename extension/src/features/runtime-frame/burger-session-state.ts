import {
  BURGER_LEVEL,
  type BurgerCarryItem,
  type BurgerIngredient,
  type BurgerOrderRecipe,
  type BurgerShiftOrderDefinition,
  type BurgerStationId,
} from './burger-level'

export const BURGER_SESSION_SAVE_VERSION = 1 as const

export type BurgerSessionPhase = 'booting' | 'running' | 'paused' | 'completed'

export interface BurgerActiveOrder {
  id: string
  recipe: BurgerOrderRecipe
  remainingTicks: number
  durationTicks: number
}

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
  shift: {
    totalOrders: number
    servedCount: number
    failedCount: number
    completedOrders: string[]
  }
  currentOrder: BurgerActiveOrder | null
  upcomingOrders: BurgerShiftOrderDefinition[]
  player: {
    location: BurgerStationId
    heldItem: BurgerCarryItem | null
  }
  log: string[]
}

export function createBurgerActiveOrder(order: BurgerShiftOrderDefinition): BurgerActiveOrder {
  return {
    id: order.id,
    recipe: order.recipe,
    remainingTicks: order.durationTicks,
    durationTicks: order.durationTicks,
  }
}

export function createInitialBurgerSessionState(): BurgerSessionState {
  const [firstOrder, ...upcomingOrders] = BURGER_LEVEL.orders

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
    shift: {
      totalOrders: BURGER_LEVEL.orders.length,
      servedCount: 0,
      failedCount: 0,
      completedOrders: [],
    },
    currentOrder: firstOrder ? createBurgerActiveOrder(firstOrder) : null,
    upcomingOrders: [...upcomingOrders],
    player: {
      location: 'storage',
      heldItem: null,
    },
    log: ['Booted the local burger shift.'],
  }
}
