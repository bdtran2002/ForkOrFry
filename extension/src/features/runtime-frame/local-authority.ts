import { BURGERS_INC_BOOTSTRAP } from '../../../upstream/generated/burgers-inc-bootstrap'
import type { UpstreamAuthorityPacket, UpstreamGameplayPacket, UpstreamItemLocation } from './upstream-bridge'

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

interface UpstreamInstantTileRecipe {
  tileInput: number
  handInput: number
  tileOutput: number | null
  handOutput: number | null
}

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

const INSTANT_TILE_RECIPES: UpstreamInstantTileRecipe[] = [
  ['pan', 'patty', 'pan:patty', null],
].flatMap(([tileInputName, handInputName, tileOutputName, handOutputName]) => {
  const tileInput = getItemIndex(tileInputName)
  const handInput = getItemIndex(handInputName)
  const tileOutput = getItemIndex(tileOutputName)
  const handOutput = handOutputName === null ? null : getItemIndex(handOutputName)
  return tileInput === null || handInput === null || tileOutput === null || handOutputName !== null && handOutput === null
    ? []
    : [{ tileInput, handInput, tileOutput, handOutput }]
})

const INSTANT_TILE_RECIPE_BY_ITEMS = new Map(INSTANT_TILE_RECIPES.map((recipe) => [`${recipe.tileInput}:${recipe.handInput}`, recipe]))

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
  tileOutput: number | null,
  handOutput: number | null,
): UpstreamAuthorityPacket[] {
  return [
    {
      type: 'set_item',
      location,
      item: null,
    },
    {
      type: 'move_item',
      from: { player: [playerId, hand] },
      to: location,
    },
    {
      type: 'set_item',
      location,
      item: null,
    },
    ...(tileOutput !== null
      ? [{ type: 'set_item' as const, location, item: tileOutput }]
      : []),
    {
      type: 'set_item',
      location: { player: [playerId, hand] },
      item: handOutput,
    },
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

  return [
    createAuthorityMovementPacket(snapshot),
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

  for (const [key, progress] of Object.entries(session.snapshot.progressTiles)) {
    const nextPosition = Math.min(1, progress.position + Math.max(0, progress.speed) * deltaSeconds)
    if (nextPosition !== progress.position) changed = true

    nextProgressTiles[key] = {
      ...progress,
      position: nextPosition,
    }
  }

  if (!changed) {
    return { session, packets: [] as UpstreamAuthorityPacket[] }
  }

  return {
    session: {
      snapshot: {
        ...session.snapshot,
        progressTiles: nextProgressTiles,
      },
    },
    packets: [] as UpstreamAuthorityPacket[],
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
    const instantTileRecipe = heldItem !== null && tileItem !== null
      ? INSTANT_TILE_RECIPE_BY_ITEMS.get(`${tileItem}:${heldItem}`) ?? null
      : null

    if (tileProgress && heldItem === null) {
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

    const cuttingBoardRecipe = getCuttingBoardRecipe(heldItem ?? tileItem, tile)

    if (isEdge && heldItem !== null && tileItem === null && cuttingBoardRecipe && cuttingBoardRecipe.input === heldItem) {
      const hands = [...session.snapshot.hands]
      hands[hand] = null
      const nextProgress: UpstreamAuthorityProgressSnapshot = {
        position: 0,
        speed: 1 / cuttingBoardRecipe.durationSeconds,
        baseSpeed: 1 / cuttingBoardRecipe.durationSeconds,
        warn: false,
        players: [session.snapshot.playerId],
        hand,
        handOutput: cuttingBoardRecipe.handOutput,
        tileOutput: cuttingBoardRecipe.tileOutput,
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

    if (isEdge && heldItem === null && tileItem !== null && cuttingBoardRecipe && !tileProgress) {
      const nextProgress: UpstreamAuthorityProgressSnapshot = {
        position: 0,
        speed: 1 / cuttingBoardRecipe.durationSeconds,
        baseSpeed: 1 / cuttingBoardRecipe.durationSeconds,
        warn: false,
        players: [session.snapshot.playerId],
        hand,
        handOutput: cuttingBoardRecipe.handOutput,
        tileOutput: cuttingBoardRecipe.tileOutput,
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
