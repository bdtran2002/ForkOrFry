// Upstream-derived snapshot for the Burgers, Inc. bootstrap content.
// This file is the checked-in source of truth for the local bootstrap payload.

export interface BurgersIncMapMetadata {
  name: string
  display_name: string
  players: number
  difficulty: number
  hand_count: number
  demand_items: string[]
}

export interface BurgersIncCharacter {
  color: number
  headwear: number
  hairstyle: number
}

export interface BurgersIncScore {
  points: number
  demands_failed: number
  demands_completed: number
  time_remaining: number
  players: number
  active_recipes: number
  passive_recipes: number
  instant_recipes: number
  stars: number
}

export type BurgersIncBootstrapPacket =
  | { type: 'version', minor: number, major: number, supports_bincode?: boolean }
  | { type: 'server_data', maps: BurgersIncMapMetadata[], bot_algos: string[], name: string, motd?: string }
  | {
    type: 'game_data'
    metadata: BurgersIncMapMetadata
    item_names: string[]
    tile_names: string[]
    tile_collide: number[]
    tile_placeable_items: Record<string, number[]>
    tile_placeable_any: number[]
    tile_interactable_empty: number[]
    hand_count: number
    is_lobby: boolean
  }
  | { type: 'update_map', changes: [[number, number], number[]][] }
  | { type: 'set_item', location: { tile: [number, number] } | { player: [number, number] }, item: number | null }
  | ({ type: 'score' } & BurgersIncScore)
  | { type: 'set_ingame', state: boolean }
  | { type: 'joined', id: number }
  | {
    type: 'add_player'
    id: number
    name: string
    position: [number, number]
    character: BurgersIncCharacter
    class: 'chef' | 'bot' | 'customer' | 'tram'
  }

export interface BurgersIncBootstrapSnapshot {
  metadata: BurgersIncMapMetadata
  playerId: number
  character: BurgersIncCharacter
  score: BurgersIncScore
  serverName: string
  motd: string
  item_names: string[]
  tile_names: string[]
  tile_collide: number[]
  tile_placeable_items: Record<string, number[]>
  tile_placeable_any: number[]
  tile_interactable_empty: number[]
  changes: [[number, number], number[]][]
  spawnPosition: [number, number]
  packets: BurgersIncBootstrapPacket[]
}

export interface BurgersIncBootstrapPayload<V extends number = number> {
  type: 'forkorfry:local-bootstrap'
  version: V
  sessionId: string
  map: string
  playerId: number
  generatedAt: string
  packets: BurgersIncBootstrapPacket[]
}

export interface BurgersIncBootstrapTemplate<V extends number = number> {
  type: 'forkorfry:local-bootstrap'
  version: V
  map: string
  playerId: number
  packets: BurgersIncBootstrapPacket[]
}

type TileDefinition = {
  tiles: string[]
  item?: string
  chefSpawn?: boolean
}

const DEFAULT_ITEM_NAMES = [
  'foodprocessor', 'plate', 'glass', 'pan', 'basket', 'steak', 'coconut', 'strawberry', 'tomato', 'lettuce',
  'cheese', 'potato', 'bun', 'dirty-plate', 'water', 'sliced-tomato', 'sliced-lettuce', 'sliced-cheese',
  'patty', 'sliced-bun', 'sliced-potato', 'pan:patty', 'pan:seared-patty', 'pan:steak', 'pan:seared-steak', 'pan:burned',
  'basket:sliced-potato', 'basket:french-fries', 'basket:burned',
  'plate:sliced-bun', 'plate:sliced-cheese', 'plate:seared-patty', 'plate:sliced-bun,sliced-cheese',
  'plate:seared-patty,sliced-bun', 'plate:seared-patty,sliced-cheese', 'plate:seared-patty,sliced-bun,sliced-cheese',
  'plate:sliced-lettuce', 'plate:sliced-tomato', 'plate:sliced-lettuce,sliced-tomato',
  'plate:seared-patty,sliced-bun,sliced-lettuce', 'plate:seared-patty,sliced-bun,sliced-tomato',
  'plate:seared-patty,sliced-bun,sliced-lettuce,sliced-tomato',
  'plate:sliced-bun,sliced-tomato', 'plate:seared-patty,sliced-tomato', 'plate:seared-patty,sliced-cheese,sliced-tomato',
  'plate:seared-patty,sliced-bun,sliced-cheese,sliced-tomato',
  'plate:french-fries', 'plate:seared-steak', 'plate:french-fries,seared-steak',
  'unknown-order', 'french-fries', 'seared-steak',
] as const

const BURGERS_INC_ROWS = [
  "'*'''''''''''''''''''''",
  "''''██▒▒█▒▒█▒▒█▒▒██'''*",
  "''''█hggpp#ALMee##█''''",
  "''''█............I█''''",
  "''''█...#ppp#....F█''''",
  "''''█|██████b....J█''''",
  "''''█.sfBC#█b....d█''''",
  "''''█......|.....d█''''",
  "''''█.####.██wwww██''''",
  '--,-|.............|----',
  '----|.............|---?',
  "'''X█ct...###..c.c█''''",
  "''''█ct...ctc..t.t█''''",
  "''''▒..........c.c█''''",
  "''''█▒█c..tc█||█████''*",
  "''''''█t..tc█......█'''",
  "*'''''█c....█.cccc.▒'''",
  "''''''█c..tc█.tttt.▒''*",
  "*'''''█t..tc█.cccc.▒''*",
  "''''''█c....|......█'''",
  "''''''█▒█▒▒██▒▒█▒▒██'''",
  "'*'''''''''''''''''''''",
  "''''''''''''''''''''''*",
] as const

const MAP_TILE_DEFINITIONS: Record<string, TileDefinition> = {
  '#': { tiles: ['floor', 'counter'] },
  f: { tiles: ['floor', 'counter'], item: 'foodprocessor' },
  p: { tiles: ['floor', 'counter'], item: 'plate' },
  g: { tiles: ['floor', 'counter'], item: 'glass' },
  w: { tiles: ['floor', 'counter-window:red'], item: 'plate' },
  h: { tiles: ['floor', 'counter', 'book'] },
  A: { tiles: ['floor', 'crate:steak'] },
  B: { tiles: ['floor', 'crate:coconut'] },
  C: { tiles: ['floor', 'crate:strawberry'] },
  F: { tiles: ['floor', 'crate:tomato'] },
  I: { tiles: ['floor', 'crate:lettuce'] },
  J: { tiles: ['floor', 'crate:cheese'] },
  L: { tiles: ['floor', 'crate:potato'] },
  M: { tiles: ['floor', 'crate:bun'] },
  X: { tiles: ['floor', 'trash'] },
  '.': { tiles: ['floor'] },
  ',': { tiles: ['path'], chefSpawn: true },
  "'": { tiles: ['grass'] },
  t: { tiles: ['floor', 'table'] },
  c: { tiles: ['floor', 'chair'] },
  '*': { tiles: ['grass', 'tree'] },
  '-': { tiles: ['path'] },
  '?': { tiles: ['path'] },
  '|': { tiles: ['floor', 'door:red'] },
  '█': { tiles: ['wall:red'] },
  '▒': { tiles: ['wall-window:red'] },
  s: { tiles: ['floor', 'counter', 'sink'] },
  e: { tiles: ['floor', 'counter', 'cutting-board'] },
  b: { tiles: ['floor', 'stove'], item: 'pan' },
  d: { tiles: ['floor', 'counter', 'deep-fryer'], item: 'basket' },
}

const TILE_FLAGS: Record<string, string> = {
  book: 'e', 'button-base': 'c', conveyor: 'ac', 'counter-window': 'ac', 'wall-window': 'c', counter: 'ac',
  crate: 'cx', 'deep-fryer': 'x', freezer: 'cx', lamp: 'c', oven: 'cx', screen: 'c', stove: 'ac', table: 'ac',
  trash: 'cx', tree: 'c', wall: 'c', fence: 'c', chair: 'W', grass: 'W',
}

function tileFlagBase(tileName: string) { return tileName.split(':', 1)[0].split(',', 1)[0] }

export function buildBurgersIncBootstrap(): BurgersIncBootstrapSnapshot {
  const tileNames: string[] = []
  const tileIndex = new Map<string, number>()
  const itemNames: string[] = [...DEFAULT_ITEM_NAMES]
  const itemIndex = new Map(itemNames.map((item, index) => [item, index]))
  const changes: [[number, number], number[]][] = []
  const setItems: Extract<BurgersIncBootstrapPacket, { type: 'set_item' }>[] = []
  let spawnPosition: [number, number] = [0.5, 0.5]

  const ensureTile = (tileName: string) => {
    const existing = tileIndex.get(tileName)
    if (existing !== undefined) return existing
    const index = tileNames.length
    tileNames.push(tileName)
    tileIndex.set(tileName, index)
    return index
  }

  const ensureItem = (itemName: string) => {
    const existing = itemIndex.get(itemName)
    if (existing !== undefined) return existing
    const index = itemNames.length
    itemNames.push(itemName)
    itemIndex.set(itemName, index)
    return index
  }

  for (const [y, row] of BURGERS_INC_ROWS.entries()) {
    for (const [x, char] of [...row].entries()) {
      const definition = MAP_TILE_DEFINITIONS[char]
      if (!definition) throw new Error(`Missing burgers_inc tile definition for '${char}' at ${x},${y}`)
      const tileStack = definition.tiles.map(ensureTile)
      changes.push([[x, y], tileStack])
      if (definition.item) {
        setItems.push({
          type: 'set_item',
          location: { tile: [x, y] },
          item: ensureItem(definition.item),
        })
      }
      if (definition.chefSpawn) spawnPosition = [x + 0.5, y + 0.5]
    }
  }

  const withFlag = (flag: string) => tileNames
    .map((tileName, index) => ({ tileName, index }))
    .filter(({ tileName }) => TILE_FLAGS[tileFlagBase(tileName)]?.includes(flag))
    .map(({ index }) => index)

  const allItemIndexes = itemNames.map((_, index) => index)
  const tile_placeable_items = Object.fromEntries(withFlag('x').map((tileIndexValue) => [String(tileIndexValue), allItemIndexes]))
  const tile_interactable_empty = Array.from(new Set([
    ...withFlag('e'),
    ...tileNames
      .map((tileName, index) => ({ tileName, index }))
      .filter(({ tileName }) => tileName.startsWith('crate:') || tileName === 'sink')
      .map(({ index }) => index),
  ]))

  const metadata: BurgersIncMapMetadata = {
    name: 'burgers_inc',
    display_name: 'Burgers, Inc.',
    players: 2,
    difficulty: 2,
    hand_count: 2,
    demand_items: [
      'plate:seared-patty,sliced-bun,sliced-cheese',
      'plate:sliced-lettuce,sliced-tomato',
      'plate:seared-patty,sliced-bun,sliced-lettuce,sliced-tomato',
      'plate:seared-patty,sliced-bun,sliced-cheese,sliced-tomato',
      'plate:french-fries',
      'plate:seared-steak',
      'plate:french-fries,seared-steak',
    ],
  }

  const character: BurgersIncCharacter = {
    color: 0,
    headwear: 0,
    hairstyle: 0,
  }

  const score: BurgersIncScore = {
    points: 0,
    demands_failed: 0,
    demands_completed: 0,
    time_remaining: 0,
    players: 1,
    active_recipes: 0,
    passive_recipes: 0,
    instant_recipes: 0,
    stars: 0,
  }

  const serverName = 'ForkOrFry Local Runtime'
  const motd = 'Offline single-player bootstrap'
  const playerId = 1
  const packets: BurgersIncBootstrapPacket[] = [
    { type: 'version', major: 13, minor: 0 },
    {
      type: 'server_data',
      maps: [metadata],
      bot_algos: [],
      name: serverName,
      motd,
    },
    {
      type: 'game_data',
      metadata,
      item_names: itemNames,
      tile_names: tileNames,
      tile_collide: withFlag('c'),
      tile_placeable_items,
      tile_placeable_any: withFlag('a'),
      tile_interactable_empty,
      hand_count: metadata.hand_count,
      is_lobby: false,
    },
    { type: 'update_map', changes },
    ...setItems,
    { type: 'score', ...score },
    { type: 'set_ingame', state: true },
    { type: 'joined', id: playerId },
    {
      type: 'add_player',
      id: playerId,
      name: 'Chef',
      position: spawnPosition,
      character,
      class: 'chef',
    },
  ]

  return {
    metadata,
    playerId,
    character,
    score,
    serverName,
    motd,
    item_names: itemNames,
    tile_names: tileNames,
    tile_collide: withFlag('c'),
    tile_placeable_any: withFlag('a'),
    tile_interactable_empty,
    tile_placeable_items,
    changes,
    spawnPosition,
    packets,
  }
}

export function createBurgersIncBootstrapTemplate<V extends number>(version: V): BurgersIncBootstrapTemplate<V> {
  return {
    type: 'forkorfry:local-bootstrap',
    version,
    map: BURGERS_INC_BOOTSTRAP.metadata.name,
    playerId: BURGERS_INC_BOOTSTRAP.playerId,
    packets: BURGERS_INC_BOOTSTRAP.packets,
  }
}

export function createBurgersIncBootstrapPayload<V extends number>(sessionId: string, version: V): BurgersIncBootstrapPayload<V> {
  return {
    ...createBurgersIncBootstrapTemplate(version),
    sessionId,
    generatedAt: new Date().toISOString(),
  }
}

export const BURGERS_INC_BOOTSTRAP = buildBurgersIncBootstrap()
