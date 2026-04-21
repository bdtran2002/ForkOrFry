export type BurgerDirection = 'up' | 'down' | 'left' | 'right'
export type BurgerInteractableKind = 'bun-crate' | 'patty-crate' | 'cheese-crate' | 'grill' | 'board' | 'counter'
export type BurgerStationId = BurgerInteractableKind
export type BurgerIngredient = 'bun' | 'patty' | 'cheese'
export type BurgerCarryIngredient = BurgerIngredient | 'cooked-patty'
export type BurgerTile = {
  x: number
  y: number
  walkable: boolean
  interactable?: BurgerInteractableKind
}
export type BurgerPosition = { x: number; y: number }

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
  spawn: { x: 1, y: 2 } satisfies BurgerPosition,
  tiles: [
    { x: 0, y: 0, walkable: false },
    { x: 1, y: 0, walkable: false },
    { x: 2, y: 0, walkable: false },
    { x: 3, y: 0, walkable: false },
    { x: 0, y: 1, walkable: true, interactable: 'bun-crate' },
    { x: 1, y: 1, walkable: true, interactable: 'grill' },
    { x: 2, y: 1, walkable: true, interactable: 'board' },
    { x: 3, y: 1, walkable: true, interactable: 'counter' },
    { x: 0, y: 2, walkable: true, interactable: 'patty-crate' },
    { x: 1, y: 2, walkable: true },
    { x: 2, y: 2, walkable: true, interactable: 'cheese-crate' },
    { x: 3, y: 2, walkable: false },
  ] as readonly BurgerTile[],
  pantry: {
    bun: 6,
    patty: 6,
    cheese: 6,
  },
  grillCookTicks: 3,
  grillBurnTicks: 6,
  orders: [
    { id: 'burger-order-1', recipeId: 'cheeseburger', durationTicks: 36 },
    { id: 'burger-order-2', recipeId: 'plain-burger', durationTicks: 32 },
    { id: 'burger-order-3', recipeId: 'cheeseburger', durationTicks: 36 },
  ] as const,
} as const

export type BurgerShiftOrderDefinition = (typeof BURGER_LEVEL.orders)[number]

export function getBurgerTile(position: BurgerPosition) {
  return BURGER_LEVEL.tiles.find((tile) => tile.x === position.x && tile.y === position.y) ?? null
}

export function getBurgerAdjacentPosition(position: BurgerPosition, direction: BurgerDirection): BurgerPosition {
  switch (direction) {
    case 'up': return { x: position.x, y: position.y - 1 }
    case 'down': return { x: position.x, y: position.y + 1 }
    case 'left': return { x: position.x - 1, y: position.y }
    case 'right': return { x: position.x + 1, y: position.y }
  }
}

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
