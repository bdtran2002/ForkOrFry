import { BURGERS_INC_BOOTSTRAP } from '../../../upstream/generated/burgers-inc-bootstrap'
import type { UpstreamAuthorityPacket, UpstreamGameplayPacket, UpstreamItemLocation } from './upstream-bridge'

export interface UpstreamAuthoritySnapshot {
  playerId: number
  position: [number, number]
  direction: [number, number]
  rotation: number
  boost: boolean
  hands: (number | null)[]
  tileItems: Record<string, number | null>
}

export interface UpstreamLocalAuthoritySession {
  snapshot: UpstreamAuthoritySnapshot
}

function createTileKey(x: number, y: number) {
  return `${x},${y}`
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

function getTileItem(snapshot: UpstreamAuthoritySnapshot, location: UpstreamItemLocation & { tile: [number, number] }) {
  return snapshot.tileItems[createTileKey(location.tile[0], location.tile[1])] ?? null
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

export function createInitialAuthoritySnapshot(): UpstreamAuthoritySnapshot {
  return {
    playerId: BURGERS_INC_BOOTSTRAP.playerId,
    position: [...BURGERS_INC_BOOTSTRAP.spawnPosition],
    direction: [0, 0],
    rotation: 0,
    boost: false,
    hands: Array.from({ length: BURGERS_INC_BOOTSTRAP.metadata.hand_count }, () => null),
    tileItems: createInitialAuthorityTileItems(),
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

  return [
    createAuthorityMovementPacket(snapshot),
    ...tileItemPackets,
    ...handItemPackets,
  ]
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
    if (!isTileTarget(target) || hand === null) {
      return { session, packets: [] as UpstreamAuthorityPacket[] }
    }

    const heldItem = getHandItem(session.snapshot, hand)
    const tileItem = getTileItem(session.snapshot, target)

    if (heldItem === null && tileItem !== null) {
      const hands = [...session.snapshot.hands]
      hands[hand] = tileItem

      const snapshot: UpstreamAuthoritySnapshot = {
        ...session.snapshot,
        hands,
        tileItems: setTileItem(session.snapshot, target, null),
      }

      return {
        session: { snapshot },
        packets: [{
          type: 'move_item',
          from: { tile: target.tile },
          to: { player: [session.snapshot.playerId, hand] },
        }],
      }
    }

    if (heldItem !== null && tileItem === null && canPlaceItemOnTile(target.tile, heldItem)) {
      const hands = [...session.snapshot.hands]
      hands[hand] = null

      const snapshot: UpstreamAuthoritySnapshot = {
        ...session.snapshot,
        hands,
        tileItems: setTileItem(session.snapshot, target, heldItem),
      }

      return {
        session: { snapshot },
        packets: [{
          type: 'move_item',
          from: { player: [session.snapshot.playerId, hand] },
          to: { tile: target.tile },
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
