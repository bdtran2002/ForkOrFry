export type BurgerStationId = 'storage' | 'grill' | 'board' | 'counter'
export type BurgerIngredient = 'bun' | 'patty' | 'cheese'
export type BurgerCarryIngredient = BurgerIngredient | 'cooked-patty'

export const BURGER_RECIPES = {
  'plain-burger': {
    label: 'Plain burger',
    ingredients: ['bun', 'cooked-patty'] as const,
  },
  cheeseburger: {
    label: 'Cheeseburger',
    ingredients: ['bun', 'cooked-patty', 'cheese'] as const,
  },
} as const

export type BurgerRecipeId = keyof typeof BURGER_RECIPES
export type BurgerCarryItem = BurgerCarryIngredient | BurgerRecipeId
export type BurgerRecipeDefinition = {
  label: string
  ingredients: readonly BurgerCarryIngredient[]
}

export const BURGER_LEVEL = {
  id: 'burger',
  pantry: {
    bun: 6,
    patty: 6,
    cheese: 6,
  },
  grillCookTicks: 3,
  orders: [
    { id: 'burger-order-1', recipeId: 'cheeseburger', durationTicks: 18 },
    { id: 'burger-order-2', recipeId: 'plain-burger', durationTicks: 16 },
    { id: 'burger-order-3', recipeId: 'cheeseburger', durationTicks: 14 },
  ] as const,
} as const

export type BurgerShiftOrderDefinition = (typeof BURGER_LEVEL.orders)[number]

export function getBurgerRecipe(recipeId: BurgerRecipeId): BurgerRecipeDefinition {
  return BURGER_RECIPES[recipeId]
}

export function isBurgerRecipeId(item: BurgerCarryItem | null): item is BurgerRecipeId {
  return item === 'plain-burger' || item === 'cheeseburger'
}

export function resolveBurgerRecipe(items: BurgerCarryIngredient[]): BurgerRecipeId | null {
  const recipeIds = Object.keys(BURGER_RECIPES) as BurgerRecipeId[]

  for (const recipeId of recipeIds) {
    const recipe = BURGER_RECIPES[recipeId]
    if (recipe.ingredients.length !== items.length) continue
    if (recipe.ingredients.every((ingredient) => items.includes(ingredient))) {
      return recipeId
    }
  }

  return null
}
