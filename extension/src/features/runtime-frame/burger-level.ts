export const BURGER_LEVEL = {
  id: 'burger',
  pantry: {
    bun: 6,
    patty: 6,
    cheese: 6,
  },
  grillCookTicks: 3,
  orderDurationTicks: 18,
  recipe: ['bun', 'cooked-patty', 'cheese'] as const,
  orders: [
    { id: 'burger-order-1', recipe: 'burger', durationTicks: 18 },
    { id: 'burger-order-2', recipe: 'burger', durationTicks: 16 },
    { id: 'burger-order-3', recipe: 'burger', durationTicks: 14 },
  ] as const,
} as const

export type BurgerStationId = 'storage' | 'grill' | 'board' | 'counter'
export type BurgerIngredient = 'bun' | 'patty' | 'cheese'
export type BurgerCarryItem = BurgerIngredient | 'cooked-patty' | 'burger'
export type BurgerOrderRecipe = (typeof BURGER_LEVEL.orders)[number]['recipe']
export type BurgerShiftOrderDefinition = (typeof BURGER_LEVEL.orders)[number]
