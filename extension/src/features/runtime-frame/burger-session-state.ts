import {
  BURGER_LEVEL,
  type BurgerCarryItem,
  type BurgerCarryIngredient,
  type BurgerIngredient,
  type BurgerRecipeId,
  type BurgerShiftOrderDefinition,
  type BurgerPosition,
} from './burger-level'

export const BURGER_SESSION_SAVE_VERSION = 8 as const

export type BurgerSessionPhase = 'booting' | 'running' | 'paused' | 'completed'

export interface BurgerActiveOrder {
  id: string
  recipeId: BurgerRecipeId
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
      patty: 'empty' | 'cooking' | 'cooked' | 'burnt'
      progressTicks: number
    }
    board: {
      items: BurgerCarryIngredient[]
      item: BurgerCarryItem | null
    }
    counter: {
      finishedBurger: BurgerCarryItem | null
      item: BurgerCarryItem | null
    }
  }
  shift: {
    totalOrders: number
    servedCount: number
    failedCount: number
    completedOrders: string[]
  }
  activeOrders: BurgerActiveOrder[]
  upcomingOrders: BurgerShiftOrderDefinition[]
  player: {
    position: BurgerPosition
    facing: 'up' | 'down' | 'left' | 'right'
    heldItem: BurgerCarryItem | null
  }
  log: string[]
}

export function createBurgerActiveOrder(order: BurgerShiftOrderDefinition): BurgerActiveOrder {
  return {
    id: order.id,
    recipeId: order.recipeId,
    remainingTicks: order.durationTicks,
    durationTicks: order.durationTicks,
  }
}

export function seedBurgerShiftOrders(tick: number) {
  const activeOrders: BurgerActiveOrder[] = []
  const upcomingOrders: BurgerShiftOrderDefinition[] = []

  for (const order of BURGER_LEVEL.orders) {
    if (order.releaseTick <= tick && activeOrders.length < BURGER_LEVEL.activeOrderLimit) {
      activeOrders.push(createBurgerActiveOrder(order))
      continue
    }

    upcomingOrders.push(order)
  }

  return { activeOrders, upcomingOrders }
}

export function createInitialBurgerSessionState(): BurgerSessionState {
  const { activeOrders, upcomingOrders } = seedBurgerShiftOrders(0)

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
        items: [],
        item: null,
      },
      counter: {
        finishedBurger: null,
        item: null,
      },
    },
    shift: {
      totalOrders: BURGER_LEVEL.orders.length,
      servedCount: 0,
      failedCount: 0,
      completedOrders: [],
    },
    activeOrders,
    upcomingOrders: [...upcomingOrders],
    player: {
      position: BURGER_LEVEL.spawn,
      facing: 'up',
      heldItem: null,
    },
    log: ['Booted the local burger shift.'],
  }
}
