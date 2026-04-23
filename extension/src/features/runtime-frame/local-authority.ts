import { BURGERS_INC_BOOTSTRAP } from '../../../upstream/generated/burgers-inc-bootstrap'
import type { UpstreamAuthorityPacket, UpstreamCharacter, UpstreamGameplayPacket, UpstreamItemLocation, UpstreamMessage, UpstreamMessageTimeout, UpstreamScore } from './upstream-bridge'

export interface UpstreamAuthorityProgressSnapshot {
  position: number
  speed: number
  baseSpeed: number
  warn: boolean
  players: number[]
  hand: number
  handOutput: number | null
  tileOutput: number | null
}

export interface UpstreamAuthorityInteractionSnapshot {
  hand: number
  tile: [number, number]
}

export interface UpstreamAuthorityCustomerSnapshot {
  id: number
  position: [number, number]
  chair: [number, number]
  table: [number, number]
  phase: 'waiting' | 'eating' | 'finishing' | 'exiting' | 'gone'
  handItem: number | null
  demandItem: number
  demandOutput: number
  demandDuration: number
  orderMessage: UpstreamMessage | null
  orderTimeout: UpstreamMessageTimeout | null
  scorePending: boolean
  timerRemaining: number
  despawnPending: boolean
  character: UpstreamCharacter
}

export interface UpstreamAuthoritySnapshot {
  playerId: number
  position: [number, number]
  direction: [number, number]
  rotation: number
  boost: boolean
  hands: (number | null)[]
  tileItems: Record<string, number | null>
  progressTiles: Record<string, UpstreamAuthorityProgressSnapshot>
  interaction: UpstreamAuthorityInteractionSnapshot | null
  score: UpstreamScore
  customer: UpstreamAuthorityCustomerSnapshot | null
}

export interface UpstreamLocalAuthoritySession {
  snapshot: UpstreamAuthoritySnapshot
}

interface UpstreamCuttingBoardRecipe {
  input: number
  handOutput: number | null
  tileOutput: number | null
  durationSeconds: number
}

interface UpstreamActiveTileRecipe {
  input: number
  handOutput: number | null
  tileOutput: number | null
  durationSeconds: number
  tilePart: string
}

interface UpstreamInstantTileRecipe {
  tileInput: number | null
  handInput: number | null
  tileOutput: number | null
  handOutput: number | null
  tilePart?: string
}

interface UpstreamPassiveStoveRecipe {
  input: number
  tileOutput: number
  durationSeconds: number
  warn: boolean
}

const CUSTOMER_ID = BURGERS_INC_BOOTSTRAP.playerId + 1
const CUSTOMER_DEMAND_DURATION = 10
const CUSTOMER_TIMEOUT_SECONDS = 90
const CUSTOMER_RESPAWN_SECONDS = 5
const PLATE_ITEM_INDEX = getItemIndex('plate')

type DemandIngredient = 'sliced-bun' | 'sliced-cheese' | 'sliced-lettuce' | 'sliced-tomato' | 'seared-patty'

function createPlateItemName(parts: DemandIngredient[]) {
  return `plate:${[...parts].sort().join(',')}`
}

function getHandAssemblyItemName(part: DemandIngredient) {
  return part === 'seared-patty' ? 'pan:seared-patty' : part
}

function getHandAssemblyOutputName(part: DemandIngredient) {
  return part === 'seared-patty' ? 'pan' : null
}

function createPlateCombineRecipes(parts: DemandIngredient[]): Array<[string, string, string, string | null]> {
  const recipes: Array<[string, string, string, string | null]> = []
  const seen = new Set<string>()

  for (const part of parts) {
    const tileInput = 'plate'
    const handInput = getHandAssemblyItemName(part)
    const tileOutput = createPlateItemName([part])
    const handOutput = getHandAssemblyOutputName(part)
    const key = `${tileInput}|${handInput}|${tileOutput}|${handOutput ?? ''}`
    if (!seen.has(key)) {
      seen.add(key)
      recipes.push([tileInput, handInput, tileOutput, handOutput])
    }
  }

  const targetMasks = 1 << parts.length
  for (let mask = 1; mask < targetMasks; mask += 1) {
    const current: DemandIngredient[] = []
    for (let index = 0; index < parts.length; index += 1) {
      if (mask & (1 << index)) current.push(parts[index])
    }

    if (current.length === parts.length) continue

    for (const part of parts) {
      if (current.includes(part)) continue
      const tileInput = createPlateItemName(current)
      const handInput = getHandAssemblyItemName(part)
      const tileOutput = createPlateItemName([...current, part])
      const handOutput = getHandAssemblyOutputName(part)
      const key = `${tileInput}|${handInput}|${tileOutput}|${handOutput ?? ''}`
      if (!seen.has(key)) {
        seen.add(key)
        recipes.push([tileInput, handInput, tileOutput, handOutput])
      }
    }
  }

  return recipes
}

const CUSTOMER_DEMAND_ITEM_NAMES = BURGERS_INC_BOOTSTRAP.metadata.demand_items.filter((itemName) => getItemIndex(itemName) !== null)
const CUSTOMER_DEMAND_ITEM_INDEXES = CUSTOMER_DEMAND_ITEM_NAMES
  .map((itemName) => getItemIndex(itemName))
  .filter((itemIndex): itemIndex is number => itemIndex !== null)

function createTileKey(x: number, y: number) {
  return `${x},${y}`
}

function createTileLocation(key: string): { tile: [number, number] } | null {
  const location = parseTileKey(key)
  return location ? { tile: location } : null
}

function parseTileKey(key: string): [number, number] | null {
  const [x, y] = key.split(',')
  const tileX = Number(x)
  const tileY = Number(y)

  return Number.isFinite(tileX) && Number.isFinite(tileY)
    ? [tileX, tileY]
    : null
}

function isItemIndex(value: unknown): value is number | null {
  return value === null || typeof value === 'number'
}

function getItemIndex(name: string) {
  const index = BURGERS_INC_BOOTSTRAP.item_names.indexOf(name)
  return index >= 0 ? index : null
}

function createInitialScore(): UpstreamScore {
  return { ...BURGERS_INC_BOOTSTRAP.score }
}

const CUTTING_BOARD_RECIPES: UpstreamCuttingBoardRecipe[] = [
  ['tomato', 'sliced-tomato', 2],
  ['lettuce', 'sliced-lettuce', 2],
  ['cheese', 'sliced-cheese', 2],
  ['steak', 'patty', 2],
  ['bun', 'sliced-bun', 1],
].flatMap(([inputName, outputName, durationSeconds]) => {
  const input = getItemIndex(inputName)
  const handOutput = getItemIndex(outputName)
  return input === null || handOutput === null
    ? []
    : [{ input, handOutput, tileOutput: null, durationSeconds }]
})

const CUTTING_BOARD_RECIPE_BY_INPUT = new Map(CUTTING_BOARD_RECIPES.map((recipe) => [recipe.input, recipe]))

const ACTIVE_TILE_RECIPES: UpstreamActiveTileRecipe[] = [
  ...CUTTING_BOARD_RECIPES.map((recipe) => ({ ...recipe, tilePart: 'cutting-board' })),
  ...[['dirty-plate', 'plate', 2] as const].flatMap(([inputName, outputName, durationSeconds]) => {
    const input = getItemIndex(inputName)
    const handOutput = getItemIndex(outputName)
    return input === null || handOutput === null
      ? []
      : [{ input, handOutput, tileOutput: null, durationSeconds, tilePart: 'sink' }]
  }),
]

const TRASH_RECIPE_TILE_PART = 'trash'

const INSTANT_TILE_RECIPES: UpstreamInstantTileRecipe[] = [
  ['pan', 'patty', 'pan:patty', null],
  ...createPlateCombineRecipes(['sliced-bun', 'sliced-cheese', 'seared-patty']),
  ...createPlateCombineRecipes(['sliced-lettuce', 'sliced-tomato']),
  ...createPlateCombineRecipes(['sliced-bun', 'seared-patty', 'sliced-lettuce', 'sliced-tomato']),
  ...createPlateCombineRecipes(['sliced-bun', 'seared-patty', 'sliced-cheese', 'sliced-tomato']),
  ...BURGERS_INC_BOOTSTRAP.item_names.flatMap((itemName) => {
    if (itemName === 'pan:burned') return [[null, 'pan:burned', null, 'pan', TRASH_RECIPE_TILE_PART] as const]
    if (itemName.startsWith('plate:')) return [[null, itemName, null, 'dirty-plate', TRASH_RECIPE_TILE_PART] as const]
    if (itemName === 'dirty-plate' || itemName === 'pan' || itemName === 'foodprocessor' || itemName === 'basket' || itemName === 'glass') {
      return []
    }
    return [[null, itemName, null, null, TRASH_RECIPE_TILE_PART] as const]
  }),
].flatMap(([tileInputName, handInputName, tileOutputName, handOutputName, tilePart]) => {
  const tileInput = tileInputName === null ? null : getItemIndex(tileInputName)
  const handInput = handInputName === null ? null : getItemIndex(handInputName)
  const tileOutput = tileOutputName === null ? null : getItemIndex(tileOutputName)
  const handOutput = handOutputName === null ? null : getItemIndex(handOutputName)
  return tileInputName !== null && tileInput === null
    || handInputName !== null && handInput === null
    || tileOutputName !== null && tileOutput === null
    || handOutputName !== null && handOutput === null
    ? []
    : [{ tileInput, handInput, tileOutput, handOutput, tilePart }]
})

const PASSIVE_STOVE_RECIPES: UpstreamPassiveStoveRecipe[] = [
  ['pan:patty', 'pan:seared-patty', 15, false],
  ['pan:seared-patty', 'pan:burned', 5, true],
].flatMap(([inputName, outputName, durationSeconds, warn]) => {
  const input = getItemIndex(inputName)
  const tileOutput = getItemIndex(outputName)
  return input === null || tileOutput === null
    ? []
    : [{ input, tileOutput, durationSeconds, warn }]
})

const PASSIVE_STOVE_RECIPE_BY_INPUT = new Map(PASSIVE_STOVE_RECIPES.map((recipe) => [recipe.input, recipe]))

function findInitialCustomerSeat() {
  const directions: [number, number][] = [[0, -1], [1, 0], [0, 1], [-1, 0]]

  for (const [position, tileIndexes] of BURGERS_INC_BOOTSTRAP.changes) {
    const isChair = tileIndexes.some((tileIndex) => BURGERS_INC_BOOTSTRAP.tile_names[tileIndex]?.split(':', 1)[0] === 'chair')
    if (!isChair) continue

    for (const [dx, dy] of directions) {
      const table: [number, number] = [position[0] + dx, position[1] + dy]
      if (tileHasPart(table, 'table')) {
        return { chair: position, table }
      }
    }
  }

  return null
}

function createInitialCustomerSnapshot(): UpstreamAuthorityCustomerSnapshot | null {
  const seat = findInitialCustomerSeat()
  const demandItem = CUSTOMER_DEMAND_ITEM_INDEXES[0] ?? null
  const dirtyPlate = getItemIndex('dirty-plate')
  if (!seat || demandItem === null || dirtyPlate === null) return null

  return {
    id: CUSTOMER_ID,
    position: [seat.chair[0] + 0.5, seat.chair[1] + 0.5],
    chair: seat.chair,
    table: seat.table,
    phase: 'waiting',
    handItem: null,
    demandItem,
    demandOutput: dirtyPlate,
    demandDuration: CUSTOMER_DEMAND_DURATION,
    orderMessage: { item: demandItem },
    orderTimeout: {
      initial: CUSTOMER_TIMEOUT_SECONDS,
      remaining: CUSTOMER_TIMEOUT_SECONDS,
      pinned: true,
    },
    scorePending: false,
    timerRemaining: 0,
    despawnPending: false,
    character: { ...BURGERS_INC_BOOTSTRAP.character },
  }
}

function createCustomerDemandSnapshot(demandItem: number, customer?: UpstreamAuthorityCustomerSnapshot | null): UpstreamAuthorityCustomerSnapshot | null {
  const base = customer ?? createInitialCustomerSnapshot()
  if (!base) return null

  return {
    ...base,
    demandItem,
    orderMessage: { item: demandItem },
    orderTimeout: {
      initial: CUSTOMER_TIMEOUT_SECONDS,
      remaining: CUSTOMER_TIMEOUT_SECONDS,
      pinned: true,
    },
    handItem: null,
    phase: 'waiting',
    scorePending: false,
    timerRemaining: 0,
    despawnPending: false,
  }
}

function createCustomerSpawnPackets(customer: UpstreamAuthorityCustomerSnapshot): UpstreamAuthorityPacket[] {
  return [
    {
      type: 'add_player',
      id: customer.id,
      name: '',
      position: customer.position,
      character: customer.character,
      class: 'customer',
    },
    createCustomerCommunicatePacket(customer),
    {
      type: 'set_item',
      location: { player: [customer.id, 0] },
      item: customer.handItem,
    },
  ]
}

function getNextCustomerDemandItem(score: UpstreamScore) {
  if (CUSTOMER_DEMAND_ITEM_INDEXES.length === 0) return null
  const demandIndex = (score.demands_completed + score.demands_failed) % CUSTOMER_DEMAND_ITEM_INDEXES.length
  return CUSTOMER_DEMAND_ITEM_INDEXES[demandIndex] ?? CUSTOMER_DEMAND_ITEM_INDEXES[0] ?? null
}

function createInitialAuthorityTileItems() {
  return Object.fromEntries(
    BURGERS_INC_BOOTSTRAP.packets
      .filter((packet): packet is Extract<typeof BURGERS_INC_BOOTSTRAP.packets[number], { type: 'set_item' }> => packet.type === 'set_item' && 'tile' in packet.location)
      .map((packet) => [createTileKey(packet.location.tile[0], packet.location.tile[1]), packet.item]),
  ) as Record<string, number | null>
}

function normalizeHands(hands: (number | null)[] | undefined) {
  const nextHands = Array.from({ length: BURGERS_INC_BOOTSTRAP.metadata.hand_count }, (_, index) => hands?.[index] ?? null)
  return nextHands.map((item) => (typeof item === 'number' ? item : null))
}

function normalizeTileItems(tileItems: Record<string, number | null> | undefined) {
  const initialTileItems = createInitialAuthorityTileItems()
  const nextTileItems: Record<string, number | null> = { ...initialTileItems }

  for (const [key, item] of Object.entries(tileItems ?? {})) {
    nextTileItems[key] = isItemIndex(item) ? item : null
  }

  return nextTileItems
}

function isProgressSnapshot(value: unknown): value is UpstreamAuthorityProgressSnapshot {
  return (
    typeof value === 'object'
    && value !== null
    && typeof (value as { position?: unknown }).position === 'number'
    && typeof (value as { speed?: unknown }).speed === 'number'
    && typeof (value as { baseSpeed?: unknown }).baseSpeed === 'number'
    && typeof (value as { warn?: unknown }).warn === 'boolean'
    && Array.isArray((value as { players?: unknown }).players)
    && (value as { players: unknown[] }).players.every((player) => typeof player === 'number')
    && typeof (value as { hand?: unknown }).hand === 'number'
    && isItemIndex((value as { handOutput?: unknown }).handOutput)
    && isItemIndex((value as { tileOutput?: unknown }).tileOutput)
  )
}

function normalizeProgressTiles(progressTiles: Record<string, UpstreamAuthorityProgressSnapshot> | undefined) {
  const nextProgressTiles: Record<string, UpstreamAuthorityProgressSnapshot> = {}

  for (const [key, progress] of Object.entries(progressTiles ?? {})) {
    if (!parseTileKey(key) || !isProgressSnapshot(progress)) continue

    nextProgressTiles[key] = {
      position: Math.max(0, Math.min(1, progress.position)),
      speed: progress.speed,
      baseSpeed: progress.baseSpeed,
      warn: progress.warn,
      players: progress.players,
      hand: progress.hand,
      handOutput: progress.handOutput,
      tileOutput: progress.tileOutput,
    }
  }

  return nextProgressTiles
}

function normalizeInteraction(interaction: UpstreamAuthorityInteractionSnapshot | null | undefined) {
  return interaction && parseTileKey(createTileKey(interaction.tile[0], interaction.tile[1])) && getHandIndex(interaction.hand) !== null
    ? { hand: interaction.hand, tile: interaction.tile }
    : null
}

function isScore(value: unknown): value is UpstreamScore {
  return (
    typeof value === 'object'
    && value !== null
    && typeof (value as { points?: unknown }).points === 'number'
    && typeof (value as { demands_failed?: unknown }).demands_failed === 'number'
    && typeof (value as { demands_completed?: unknown }).demands_completed === 'number'
    && typeof (value as { time_remaining?: unknown }).time_remaining === 'number'
    && typeof (value as { players?: unknown }).players === 'number'
    && typeof (value as { active_recipes?: unknown }).active_recipes === 'number'
    && typeof (value as { passive_recipes?: unknown }).passive_recipes === 'number'
    && typeof (value as { instant_recipes?: unknown }).instant_recipes === 'number'
    && typeof (value as { stars?: unknown }).stars === 'number'
  )
}

function isMessage(value: unknown): value is UpstreamMessage | null {
  return value === null || (typeof value === 'object' && value !== null && typeof (value as { item?: unknown }).item === 'number')
}

function isMessageTimeout(value: unknown): value is UpstreamMessageTimeout | null {
  return value === null || (
    typeof value === 'object'
    && value !== null
    && typeof (value as { initial?: unknown }).initial === 'number'
    && typeof (value as { remaining?: unknown }).remaining === 'number'
    && typeof (value as { pinned?: unknown }).pinned === 'boolean'
  )
}

function isCharacter(value: unknown): value is UpstreamCharacter {
  return (
    typeof value === 'object'
    && value !== null
    && typeof (value as { color?: unknown }).color === 'number'
    && typeof (value as { headwear?: unknown }).headwear === 'number'
    && typeof (value as { hairstyle?: unknown }).hairstyle === 'number'
  )
}

function normalizeCustomer(customer: UpstreamAuthorityCustomerSnapshot | null | undefined) {
  const initial = createInitialCustomerSnapshot()
  if (!customer || !initial) return initial
  if (!isVector2(customer.position) || !isVector2(customer.chair) || !isVector2(customer.table)) return initial
  if (!['waiting', 'eating', 'finishing', 'exiting', 'gone'].includes(customer.phase)) return initial
  if (!isItemIndex(customer.handItem) || typeof customer.demandItem !== 'number' || typeof customer.demandOutput !== 'number') return initial
  if (typeof customer.demandDuration !== 'number' || typeof customer.timerRemaining !== 'number') return initial
  if (!isMessage(customer.orderMessage) || !isMessageTimeout(customer.orderTimeout)) return initial
  if (typeof customer.scorePending !== 'boolean' || typeof customer.despawnPending !== 'boolean' || !isCharacter(customer.character)) return initial

  return {
    ...initial,
    ...customer,
    timerRemaining: Math.max(0, customer.timerRemaining),
  }
}

function getTileItem(snapshot: UpstreamAuthoritySnapshot, location: UpstreamItemLocation & { tile: [number, number] }) {
  return snapshot.tileItems[createTileKey(location.tile[0], location.tile[1])] ?? null
}

function getTileProgress(snapshot: UpstreamAuthoritySnapshot, location: UpstreamItemLocation & { tile: [number, number] }) {
  return snapshot.progressTiles[createTileKey(location.tile[0], location.tile[1])] ?? null
}

function setTileItem(snapshot: UpstreamAuthoritySnapshot, location: UpstreamItemLocation & { tile: [number, number] }, item: number | null) {
  return {
    ...snapshot.tileItems,
    [createTileKey(location.tile[0], location.tile[1])]: item,
  }
}

function isTileTarget(value: unknown): value is Extract<UpstreamItemLocation, { tile: [number, number] }> {
  return isVector2((value as { tile?: unknown })?.tile)
}

function getHandIndex(value: unknown) {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value < BURGERS_INC_BOOTSTRAP.metadata.hand_count
    ? value
    : null
}

function getHandItem(snapshot: UpstreamAuthoritySnapshot, hand: number) {
  return snapshot.hands[hand] ?? null
}

function canPlaceItemOnTile(position: [number, number], item: number) {
  const change = BURGERS_INC_BOOTSTRAP.changes.find(([tilePosition]) => tilePosition[0] === position[0] && tilePosition[1] === position[1])
  if (!change) return false

  for (const tileIndex of change[1]) {
    if (BURGERS_INC_BOOTSTRAP.tile_placeable_any.includes(tileIndex)) return true
    const placeableItems = BURGERS_INC_BOOTSTRAP.tile_placeable_items[String(tileIndex)]
    if (placeableItems?.includes(item)) return true
  }

  return false
}

function tileHasPart(position: [number, number], partName: string) {
  const change = BURGERS_INC_BOOTSTRAP.changes.find(([tilePosition]) => tilePosition[0] === position[0] && tilePosition[1] === position[1])
  if (!change) return false

  return change[1].some((tileIndex) => BURGERS_INC_BOOTSTRAP.tile_names[tileIndex]?.split(':', 1)[0] === partName)
}

function getCuttingBoardRecipe(item: number | null, position: [number, number]) {
  if (item === null || !tileHasPart(position, 'cutting-board')) return null
  return CUTTING_BOARD_RECIPE_BY_INPUT.get(item) ?? null
}

function getActiveTileRecipe(item: number | null, position: [number, number]) {
  if (item === null) return null
  return ACTIVE_TILE_RECIPES.find((recipe) => recipe.input === item && tileHasPart(position, recipe.tilePart)) ?? null
}

function getPassiveStoveRecipe(item: number | null, position: [number, number]) {
  if (item === null || !tileHasPart(position, 'stove')) return null
  return PASSIVE_STOVE_RECIPE_BY_INPUT.get(item) ?? null
}

function getInstantTileRecipe(tileItem: number | null, heldItem: number | null, position: [number, number]) {
  return INSTANT_TILE_RECIPES.find((recipe) => (
    recipe.tileInput === tileItem
    && recipe.handInput === heldItem
    && (!recipe.tilePart || tileHasPart(position, recipe.tilePart))
  )) ?? null
}

function getRenewableSourceItem(position: [number, number]) {
  const change = BURGERS_INC_BOOTSTRAP.changes.find(([tilePosition]) => tilePosition[0] === position[0] && tilePosition[1] === position[1])
  if (!change) return null

  for (const tileIndex of change[1]) {
    const tileName = BURGERS_INC_BOOTSTRAP.tile_names[tileIndex] ?? ''
    if (tileName.startsWith('crate:')) {
      const itemName = tileName.slice('crate:'.length)
      return getItemIndex(itemName)
    }
  }

  const initialTileItem = createInitialAuthorityTileItems()[createTileKey(position[0], position[1])] ?? null
  if (initialTileItem === PLATE_ITEM_INDEX && (tileHasPart(position, 'counter') || tileHasPart(position, 'counter-window'))) {
    return PLATE_ITEM_INDEX
  }

  return null
}

function createProgressPacket(location: { tile: [number, number] }, progress: UpstreamAuthorityProgressSnapshot): Extract<UpstreamAuthorityPacket, { type: 'set_progress' }> {
  return {
    type: 'set_progress',
    players: progress.players,
    item: location,
    position: progress.position,
    speed: progress.speed,
    warn: progress.warn,
  }
}

function createScorePacket(score: UpstreamScore): Extract<UpstreamAuthorityPacket, { type: 'score' }> {
  return { type: 'score', ...score }
}

function createCustomerCommunicatePacket(customer: UpstreamAuthorityCustomerSnapshot): Extract<UpstreamAuthorityPacket, { type: 'communicate' }> {
  return {
    type: 'communicate',
    player: customer.id,
    message: customer.orderMessage,
    timeout: customer.orderTimeout,
  }
}

function createCompletionPackets(
  location: { tile: [number, number] },
  playerId: number,
  hand: number,
  handOutput: number | null,
  tileOutput: number | null,
): UpstreamAuthorityPacket[] {
  return [
    {
      type: 'set_item',
      location,
      item: null,
    },
    {
      type: 'set_item',
      location,
      item: handOutput,
    },
    {
      type: 'move_item',
      from: location,
      to: { player: [playerId, hand] },
    },
    ...(tileOutput !== null
      ? [{ type: 'set_item' as const, location, item: tileOutput }]
      : []),
  ]
}

function createPassiveCompletionPackets(
  location: { tile: [number, number] },
  progress: UpstreamAuthorityProgressSnapshot,
): UpstreamAuthorityPacket[] {
  return [
    {
      type: 'set_progress',
      players: [],
      item: location,
      position: 1,
      speed: 0,
      warn: progress.warn,
    },
    {
      type: 'set_item',
      location,
      item: progress.tileOutput,
    },
  ]
}

function setTileProgress(
  snapshot: UpstreamAuthoritySnapshot,
  location: [number, number],
  progress: UpstreamAuthorityProgressSnapshot | null,
) {
  const key = createTileKey(location[0], location[1])
  const nextProgressTiles = { ...snapshot.progressTiles }
  if (progress) nextProgressTiles[key] = progress
  else delete nextProgressTiles[key]
  return nextProgressTiles
}

function createInstantRecipePackets(
  location: { tile: [number, number] },
  playerId: number,
  hand: number,
  tileHadItem: boolean,
  handHadItem: boolean,
  tileOutput: number | null,
  handOutput: number | null,
): UpstreamAuthorityPacket[] {
  return [
    ...(tileHadItem
      ? [{ type: 'set_item' as const, location, item: null }]
      : []),
    ...(handHadItem
      ? [
        {
          type: 'move_item' as const,
          from: { player: [playerId, hand] as [number, number] },
          to: location,
        },
        { type: 'set_item' as const, location, item: null },
      ]
      : []),
    ...(handOutput !== null
      ? [
        { type: 'set_item' as const, location, item: handOutput },
        {
          type: 'move_item' as const,
          from: location,
          to: { player: [playerId, hand] as [number, number] },
        },
      ]
      : []),
    ...(tileOutput !== null
      ? [{ type: 'set_item' as const, location, item: tileOutput }]
      : []),
  ]
}

export function createInitialAuthoritySnapshot(): UpstreamAuthoritySnapshot {
  return {
    playerId: BURGERS_INC_BOOTSTRAP.playerId,
    position: [...BURGERS_INC_BOOTSTRAP.spawnPosition],
    direction: [0, 0],
    rotation: 0,
    boost: false,
    hands: Array.from({ length: BURGERS_INC_BOOTSTRAP.metadata.hand_count }, () => null),
    tileItems: createInitialAuthorityTileItems(),
    progressTiles: {},
    interaction: null,
    score: createInitialScore(),
    customer: createInitialCustomerSnapshot(),
  }
}

export function createLocalAuthoritySession(snapshot?: UpstreamAuthoritySnapshot | null): UpstreamLocalAuthoritySession {
  const initialSnapshot = createInitialAuthoritySnapshot()

  return {
    snapshot: snapshot
      ? {
        ...initialSnapshot,
        ...snapshot,
        hands: normalizeHands(snapshot.hands),
        tileItems: normalizeTileItems(snapshot.tileItems),
        progressTiles: normalizeProgressTiles(snapshot.progressTiles),
        interaction: normalizeInteraction(snapshot.interaction),
        score: isScore(snapshot.score) ? snapshot.score : initialSnapshot.score,
        customer: normalizeCustomer(snapshot.customer),
      }
      : initialSnapshot,
  }
}

function isVector2(value: unknown): value is [number, number] {
  return Array.isArray(value) && value.length === 2 && value.every((part) => typeof part === 'number')
}

function calculateRotation(direction: [number, number], previousRotation: number) {
  const [x, y] = direction
  return Math.abs(x) > 0.05 || Math.abs(y) > 0.05
    ? Math.atan2(x, y)
    : previousRotation
}

export function createAuthorityMovementPacket(snapshot: UpstreamAuthoritySnapshot): UpstreamAuthorityPacket {
  return {
    type: 'movement',
    player: snapshot.playerId,
    pos: snapshot.position,
    rot: snapshot.rotation,
    dir: snapshot.direction,
    boost: snapshot.boost,
    sync: false,
  }
}

export function createAuthorityStatePackets(snapshot: UpstreamAuthoritySnapshot): UpstreamAuthorityPacket[] {
  const tileItemPackets = Object.entries(snapshot.tileItems)
    .map(([key, item]) => {
      const location = parseTileKey(key)
      if (!location) return null

      return {
        type: 'set_item' as const,
        location: { tile: location },
        item,
      }
    })
    .filter((packet): packet is Extract<UpstreamAuthorityPacket, { type: 'set_item' }> => packet !== null)

  const handItemPackets = snapshot.hands.map((item, hand) => ({
    type: 'set_item' as const,
    location: { player: [snapshot.playerId, hand] as [number, number] },
    item,
  }))

  const progressPackets = Object.entries(snapshot.progressTiles)
    .map(([key, progress]) => {
      const location = createTileLocation(key)
      return location ? createProgressPacket(location, progress) : null
    })
    .filter((packet): packet is Extract<UpstreamAuthorityPacket, { type: 'set_progress' }> => packet !== null)

  const customerPackets: UpstreamAuthorityPacket[] = snapshot.customer && snapshot.customer.phase !== 'gone'
    ? createCustomerSpawnPackets(snapshot.customer)
    : []

  return [
    createAuthorityMovementPacket(snapshot),
    createScorePacket(snapshot.score),
    ...customerPackets,
    ...tileItemPackets,
    ...handItemPackets,
    ...progressPackets,
  ]
}

export function advanceAuthoritySession(
  session: UpstreamLocalAuthoritySession,
  deltaSeconds: number,
) {
  if (!Number.isFinite(deltaSeconds) || deltaSeconds <= 0) {
    return { session, packets: [] as UpstreamAuthorityPacket[] }
  }

  let changed = false
  const nextProgressTiles: Record<string, UpstreamAuthorityProgressSnapshot> = {}
  const packets: UpstreamAuthorityPacket[] = []
  let nextScore = session.snapshot.score
  let nextCustomer = session.snapshot.customer

  for (const [key, progress] of Object.entries(session.snapshot.progressTiles)) {
    const location = createTileLocation(key)
    const nextPosition = Math.min(1, progress.position + Math.max(0, progress.speed) * deltaSeconds)
    if (nextPosition !== progress.position) changed = true

    if (location && progress.handOutput === null && progress.tileOutput !== null && progress.speed > 0 && nextPosition >= 1) {
      packets.push(...createPassiveCompletionPackets(location, progress))
      continue
    }

    nextProgressTiles[key] = {
      ...progress,
      position: nextPosition,
    }
  }

  const nextTileItems = { ...session.snapshot.tileItems }
  for (const packet of packets) {
    if (packet.type !== 'set_item' || !('tile' in packet.location)) continue
    nextTileItems[createTileKey(packet.location.tile[0], packet.location.tile[1])] = packet.item
  }

  if (nextCustomer?.phase === 'waiting') {
    const nextTimeout = nextCustomer.orderTimeout
      ? {
        ...nextCustomer.orderTimeout,
        remaining: Math.max(0, nextCustomer.orderTimeout.remaining - deltaSeconds),
      }
      : null

    if (nextTimeout && nextTimeout.remaining !== nextCustomer.orderTimeout?.remaining) {
      changed = true
      nextCustomer = {
        ...nextCustomer,
        orderTimeout: nextTimeout,
      }
    }

    if (nextTimeout && nextTimeout.remaining <= 0) {
      nextScore = {
        ...nextScore,
        points: nextScore.points - 1,
        demands_failed: nextScore.demands_failed + 1,
      }
      nextCustomer = {
        ...nextCustomer,
        phase: 'exiting',
        orderMessage: null,
        orderTimeout: null,
        despawnPending: true,
        timerRemaining: CUSTOMER_RESPAWN_SECONDS,
      }
      packets.push(
        createCustomerCommunicatePacket(nextCustomer),
        { type: 'effect', effect: 'angry', location: { player: [nextCustomer.id, 0] } },
        { type: 'effect', effect: 'points', amount: -1, location: { player: [nextCustomer.id, 0] } },
        createScorePacket(nextScore),
      )
    }

    const tableLocation = { tile: nextCustomer.table } as const
    const tableItem = nextTileItems[createTileKey(nextCustomer.table[0], nextCustomer.table[1])] ?? null
    if (nextCustomer.phase === 'waiting' && tableItem === nextCustomer.demandItem) {
      changed = true
      nextTileItems[createTileKey(nextCustomer.table[0], nextCustomer.table[1])] = null
      nextScore = {
        ...nextScore,
        points: nextScore.points + 9,
        demands_completed: nextScore.demands_completed + 1,
      }
      nextCustomer = {
        ...nextCustomer,
        phase: 'eating',
        handItem: nextCustomer.demandItem,
        orderMessage: null,
        orderTimeout: null,
        scorePending: false,
        timerRemaining: nextCustomer.demandDuration,
      }
      packets.push(
        createCustomerCommunicatePacket(nextCustomer),
        { type: 'effect', effect: 'satisfied', location: { player: [nextCustomer.id, 0] } },
        { type: 'effect', effect: 'points', amount: 9, location: { player: [nextCustomer.id, 0] } },
        { type: 'move_item', from: tableLocation, to: { player: [nextCustomer.id, 0] } },
        createScorePacket(nextScore),
      )
    }
  } else if (nextCustomer?.phase === 'eating') {
    const timerRemaining = Math.max(0, nextCustomer.timerRemaining - deltaSeconds)
    if (nextCustomer.scorePending) {
      changed = true
      packets.push(createScorePacket(nextScore))
      nextCustomer = { ...nextCustomer, scorePending: false, timerRemaining }
    } else if (timerRemaining <= 0) {
      changed = true
      nextCustomer = {
        ...nextCustomer,
        phase: 'finishing',
        handItem: nextCustomer.demandOutput,
        timerRemaining: 0,
      }
      packets.push({
        type: 'set_item',
        location: { player: [nextCustomer.id, 0] },
        item: nextCustomer.demandOutput,
      })
    } else if (timerRemaining !== nextCustomer.timerRemaining) {
      changed = true
      nextCustomer = { ...nextCustomer, timerRemaining }
    }
  } else if (nextCustomer?.phase === 'finishing') {
    const tableKey = createTileKey(nextCustomer.table[0], nextCustomer.table[1])
    if (nextCustomer.handItem !== null && (nextTileItems[tableKey] ?? null) === null) {
      changed = true
      nextTileItems[tableKey] = nextCustomer.handItem
      packets.push({
        type: 'move_item',
        from: { player: [nextCustomer.id, 0] },
        to: { tile: nextCustomer.table },
      })
      nextCustomer = {
        ...nextCustomer,
        phase: 'exiting',
        handItem: null,
        despawnPending: true,
      }
    }
  } else if (nextCustomer?.phase === 'exiting' && nextCustomer.despawnPending) {
    changed = true
    packets.push({ type: 'remove_player', id: nextCustomer.id })
    nextCustomer = {
      ...nextCustomer,
      phase: 'gone',
      despawnPending: false,
      timerRemaining: CUSTOMER_RESPAWN_SECONDS,
    }
  } else if (nextCustomer?.phase === 'gone') {
    const timerRemaining = Math.max(0, nextCustomer.timerRemaining - deltaSeconds)
    if (timerRemaining <= 0) {
      const nextDemandItem = getNextCustomerDemandItem(nextScore)
      const respawned = nextDemandItem === null
        ? null
        : createCustomerDemandSnapshot(nextDemandItem, nextCustomer)
      if (respawned) {
        changed = true
        nextCustomer = respawned
        packets.push(...createCustomerSpawnPackets(respawned))
      }
    } else if (timerRemaining !== nextCustomer.timerRemaining) {
      changed = true
      nextCustomer = {
        ...nextCustomer,
        timerRemaining,
      }
    }
  }

  if (!changed) {
    return { session, packets }
  }

  return {
    session: {
      snapshot: {
        ...session.snapshot,
        tileItems: nextTileItems,
        progressTiles: nextProgressTiles,
        score: nextScore,
        customer: nextCustomer,
      },
    },
    packets,
  }
}

function resolveInteractionTile(packet: UpstreamGameplayPacket, snapshot: UpstreamAuthoritySnapshot) {
  if (packet.action !== 'interact') return null
  if (isTileTarget(packet.payload.target)) return packet.payload.target.tile
  return snapshot.interaction?.tile ?? null
}

export function applyGameplayPacketToAuthority(
  session: UpstreamLocalAuthoritySession,
  packet: UpstreamGameplayPacket,
) {
  if (packet.action !== 'movement') {
    if (packet.action !== 'interact') {
      return { session, packets: [] as UpstreamAuthorityPacket[] }
    }

    const target = packet.payload.target
    const hand = getHandIndex(packet.payload.hand)
    const tile = resolveInteractionTile(packet, session.snapshot)
    if (!tile || hand === null) {
      return { session, packets: [] as UpstreamAuthorityPacket[] }
    }

    const targetLocation = { tile } as const
    const isEdge = isTileTarget(target)
    const interaction = isEdge ? { hand, tile } : null

    const heldItem = getHandItem(session.snapshot, hand)
    const tileItem = getTileItem(session.snapshot, targetLocation)
    const tileProgress = getTileProgress(session.snapshot, targetLocation)
    const instantTileRecipe = getInstantTileRecipe(tileItem, heldItem, tile)

    if (tileProgress && heldItem === null && tileProgress.handOutput !== null) {
      if (tileProgress.position >= 1) {
        const hands = [...session.snapshot.hands]
        hands[hand] = tileProgress.handOutput

        const snapshot: UpstreamAuthoritySnapshot = {
          ...session.snapshot,
          hands,
          tileItems: setTileItem(session.snapshot, targetLocation, tileProgress.tileOutput),
          progressTiles: setTileProgress(session.snapshot, tile, null),
          interaction,
        }

        return {
          session: { snapshot },
          packets: createCompletionPackets(targetLocation, session.snapshot.playerId, hand, tileProgress.handOutput, tileProgress.tileOutput),
        }
      }

      const players = isEdge ? [session.snapshot.playerId] : []
      const nextProgress: UpstreamAuthorityProgressSnapshot = {
        ...tileProgress,
        players,
        speed: tileProgress.baseSpeed * players.length,
        hand,
      }

      const snapshot: UpstreamAuthoritySnapshot = {
        ...session.snapshot,
        progressTiles: setTileProgress(session.snapshot, tile, nextProgress),
        interaction,
      }

      return {
        session: { snapshot },
        packets: [createProgressPacket(targetLocation, nextProgress)],
      }
    }

    if (tileProgress && tileProgress.handOutput === null) {
      return { session, packets: [] as UpstreamAuthorityPacket[] }
    }

    const activeTileRecipe = getActiveTileRecipe(heldItem ?? tileItem, tile)
    const passiveStoveRecipe = getPassiveStoveRecipe(tileItem, tile)
    const sourceItem = getRenewableSourceItem(tile)

    if (isEdge && heldItem === null && sourceItem !== null) {
      const hands = [...session.snapshot.hands]
      hands[hand] = sourceItem
      const nextScore = {
        ...session.snapshot.score,
        points: session.snapshot.score.points - 1,
      }

      return {
        session: {
          snapshot: {
            ...session.snapshot,
            hands,
            score: nextScore,
            interaction,
          },
        },
        packets: [
          {
            type: 'set_item',
            location: { player: [session.snapshot.playerId, hand] },
            item: sourceItem,
          },
          createScorePacket(nextScore),
        ],
      }
    }

    if (isEdge && heldItem !== null && sourceItem !== null && heldItem === sourceItem) {
      const hands = [...session.snapshot.hands]
      hands[hand] = null
      const nextScore = {
        ...session.snapshot.score,
        points: session.snapshot.score.points + 1,
      }

      return {
        session: {
          snapshot: {
            ...session.snapshot,
            hands,
            score: nextScore,
            interaction,
          },
        },
        packets: [
          {
            type: 'set_item',
            location: { player: [session.snapshot.playerId, hand] },
            item: null,
          },
          createScorePacket(nextScore),
        ],
      }
    }

    if (isEdge && heldItem !== null && tileItem === null && activeTileRecipe && activeTileRecipe.input === heldItem) {
      const hands = [...session.snapshot.hands]
      hands[hand] = null
      const nextProgress: UpstreamAuthorityProgressSnapshot = {
        position: 0,
        speed: 1 / activeTileRecipe.durationSeconds,
        baseSpeed: 1 / activeTileRecipe.durationSeconds,
        warn: false,
        players: [session.snapshot.playerId],
        hand,
        handOutput: activeTileRecipe.handOutput,
        tileOutput: activeTileRecipe.tileOutput,
      }

      const snapshot: UpstreamAuthoritySnapshot = {
        ...session.snapshot,
        hands,
        tileItems: setTileItem(session.snapshot, targetLocation, heldItem),
        progressTiles: setTileProgress(session.snapshot, tile, nextProgress),
        interaction,
      }

      return {
        session: { snapshot },
        packets: [
          {
            type: 'move_item',
            from: { player: [session.snapshot.playerId, hand] },
            to: targetLocation,
          },
          createProgressPacket(targetLocation, nextProgress),
        ],
      }
    }

    if (isEdge && heldItem === null && tileItem !== null && activeTileRecipe && !tileProgress) {
      const nextProgress: UpstreamAuthorityProgressSnapshot = {
        position: 0,
        speed: 1 / activeTileRecipe.durationSeconds,
        baseSpeed: 1 / activeTileRecipe.durationSeconds,
        warn: false,
        players: [session.snapshot.playerId],
        hand,
        handOutput: activeTileRecipe.handOutput,
        tileOutput: activeTileRecipe.tileOutput,
      }

      const snapshot: UpstreamAuthoritySnapshot = {
        ...session.snapshot,
        progressTiles: setTileProgress(session.snapshot, tile, nextProgress),
        interaction,
      }

      return {
        session: { snapshot },
        packets: [createProgressPacket(targetLocation, nextProgress)],
      }
    }

    if (isEdge && heldItem === null && tileItem !== null && passiveStoveRecipe && !tileProgress) {
      const nextProgress: UpstreamAuthorityProgressSnapshot = {
        position: 0,
        speed: 1 / passiveStoveRecipe.durationSeconds,
        baseSpeed: 1 / passiveStoveRecipe.durationSeconds,
        warn: passiveStoveRecipe.warn,
        players: [],
        hand,
        handOutput: null,
        tileOutput: passiveStoveRecipe.tileOutput,
      }

      const snapshot: UpstreamAuthoritySnapshot = {
        ...session.snapshot,
        progressTiles: setTileProgress(session.snapshot, tile, nextProgress),
        interaction: null,
      }

      return {
        session: { snapshot },
        packets: [createProgressPacket(targetLocation, nextProgress)],
      }
    }

    if (isEdge && instantTileRecipe) {
      const hands = [...session.snapshot.hands]
      hands[hand] = instantTileRecipe.handOutput

      const snapshot: UpstreamAuthoritySnapshot = {
        ...session.snapshot,
        hands,
        tileItems: setTileItem(session.snapshot, targetLocation, instantTileRecipe.tileOutput),
        interaction,
      }

      return {
        session: { snapshot },
        packets: createInstantRecipePackets(
          targetLocation,
          session.snapshot.playerId,
          hand,
          tileItem !== null,
          heldItem !== null,
          instantTileRecipe.tileOutput,
          instantTileRecipe.handOutput,
        ),
      }
    }

    if (heldItem === null && tileItem !== null) {
      const hands = [...session.snapshot.hands]
      hands[hand] = tileItem

      const snapshot: UpstreamAuthoritySnapshot = {
        ...session.snapshot,
        hands,
        tileItems: setTileItem(session.snapshot, targetLocation, null),
        interaction,
      }

      return {
        session: { snapshot },
        packets: [{
          type: 'move_item',
          from: targetLocation,
          to: { player: [session.snapshot.playerId, hand] },
        }],
      }
    }

    if (isEdge && heldItem !== null && tileItem === null && canPlaceItemOnTile(tile, heldItem)) {
      const hands = [...session.snapshot.hands]
      hands[hand] = null

      const snapshot: UpstreamAuthoritySnapshot = {
        ...session.snapshot,
        hands,
        tileItems: setTileItem(session.snapshot, targetLocation, heldItem),
        interaction,
      }

      return {
        session: { snapshot },
        packets: [{
          type: 'move_item',
          from: { player: [session.snapshot.playerId, hand] },
          to: targetLocation,
        }],
      }
    }

    return { session, packets: [] as UpstreamAuthorityPacket[] }
  }

  const playerId = typeof packet.payload.player === 'number' ? packet.payload.player : session.snapshot.playerId
  const position = isVector2(packet.payload.pos) ? packet.payload.pos : session.snapshot.position
  const direction = isVector2(packet.payload.dir) ? packet.payload.dir : session.snapshot.direction
  const boost = typeof packet.payload.boost === 'boolean' ? packet.payload.boost : session.snapshot.boost

  const snapshot: UpstreamAuthoritySnapshot = {
    ...session.snapshot,
    playerId,
    position,
    direction,
    rotation: calculateRotation(direction, session.snapshot.rotation),
    boost,
  }

  return {
    session: { snapshot },
    packets: [createAuthorityMovementPacket(snapshot)],
  }
}
