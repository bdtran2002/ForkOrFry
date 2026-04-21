export const BURGER_LEVEL = {
  id: 'burger',
  pantry: {
    bun: 2,
    patty: 2,
    cheese: 2,
  },
  grillCookTicks: 3,
  orderDurationTicks: 18,
  recipe: ['bun', 'cooked-patty', 'cheese'] as const,
} as const

export type BurgerStationId = 'storage' | 'grill' | 'board' | 'counter'
export type BurgerIngredient = 'bun' | 'patty' | 'cheese'
export type BurgerCarryItem = BurgerIngredient | 'cooked-patty' | 'burger'
