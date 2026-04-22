export const UPSTREAM_BRIDGE_PROTOCOL_VERSION = 1 as const

export type UpstreamBridgeState = 'idle' | 'waiting' | 'sent' | 'acknowledged' | 'error'

export interface UpstreamMapMetadata {
  name: string
  display_name: string
  players: number
  difficulty: number
  hand_count: number
  demand_items: string[]
}

export interface UpstreamServerdata {
  maps: UpstreamMapMetadata[]
  bot_algos: string[]
  name: string
  motd?: string
}

export interface UpstreamGamedata {
  metadata: UpstreamMapMetadata
  item_names: string[]
  tile_names: string[]
  tile_collide: number[]
  tile_placeable_items: Record<string, number[]>
  tile_placeable_any: number[]
  tile_interactable_empty: number[]
  hand_count: number
  is_lobby: boolean
}

export interface UpstreamCharacter {
  color: number
  headwear: number
  hairstyle: number
}

export type UpstreamItemLocation =
  | { tile: [number, number] }
  | { player: [number, number] }

export interface UpstreamScore {
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

export type UpstreamBootstrapPacket =
  | { type: 'version', minor: number, major: number, supports_bincode?: boolean }
  | ({ type: 'server_data' } & UpstreamServerdata)
  | ({ type: 'game_data' } & UpstreamGamedata)
  | { type: 'update_map', changes: [[number, number], number[]][] }
  | { type: 'set_item', location: UpstreamItemLocation, item: number | null }
  | ({ type: 'score' } & UpstreamScore)
  | { type: 'set_ingame', state: boolean }
  | { type: 'joined', id: number }
  | { type: 'add_player', id: number, name: string, position: [number, number], character: UpstreamCharacter, class: 'chef' | 'bot' | 'customer' | 'tram' }

export interface UpstreamBootstrapPayload {
  type: 'forkorfry:local-bootstrap'
  version: typeof UPSTREAM_BRIDGE_PROTOCOL_VERSION
  sessionId: string
  map: string
  playerId: number
  generatedAt: string
  packets: UpstreamBootstrapPacket[]
}

export interface UpstreamBridgeSnapshot {
  acknowledgedSessionId: string | null
  acknowledgedPacketCount: number
  lastError: string | null
}

export type UpstreamParentToEmbeddedMessage =
  | { type: 'forkorfry:bridge-bootstrap', version: typeof UPSTREAM_BRIDGE_PROTOCOL_VERSION, payload: UpstreamBootstrapPayload }
  | { type: 'forkorfry:bridge-pause', version: typeof UPSTREAM_BRIDGE_PROTOCOL_VERSION, reason: string }
  | { type: 'forkorfry:bridge-resume', version: typeof UPSTREAM_BRIDGE_PROTOCOL_VERSION, payload: UpstreamBootstrapPayload }
  | { type: 'forkorfry:bridge-authority-packets', version: typeof UPSTREAM_BRIDGE_PROTOCOL_VERSION, packets: UpstreamAuthorityPacket[] }

export type UpstreamEmbeddedToParentMessage =
  | { type: 'forkorfry:bridge-ready', version: typeof UPSTREAM_BRIDGE_PROTOCOL_VERSION }
  | { type: 'forkorfry:bridge-bootstrap-ack', version: typeof UPSTREAM_BRIDGE_PROTOCOL_VERSION, sessionId: string, packetCount: number }
  | { type: 'forkorfry:bridge-error', version: typeof UPSTREAM_BRIDGE_PROTOCOL_VERSION, detail: string }
  | UpstreamGameplayPacket

export type UpstreamGameplayAction = 'movement' | 'interact' | 'ready' | 'idle'

export interface UpstreamGameplayPacket {
  type: 'forkorfry:bridge-gameplay-packet'
  version: typeof UPSTREAM_BRIDGE_PROTOCOL_VERSION
  action: UpstreamGameplayAction
  payload: Record<string, unknown>
}

export type UpstreamAuthorityPacket =
  | {
    type: 'movement'
    player: number
    pos: [number, number]
    rot: number
    dir: [number, number]
    boost: boolean
    sync?: boolean
  }
  | {
    type: 'move_item'
    from: UpstreamItemLocation
    to: UpstreamItemLocation
  }
  | {
    type: 'set_item'
    location: UpstreamItemLocation
    item: number | null
  }
  | {
    type: 'set_progress'
    players: number[]
    item: UpstreamItemLocation
    position: number
    speed: number
    warn: boolean
  }
  | {
    type: 'clear_progress'
    item: UpstreamItemLocation
  }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isMapMetadata(value: unknown): value is UpstreamMapMetadata {
  return (
    isRecord(value)
    && typeof value.name === 'string'
    && typeof value.display_name === 'string'
    && typeof value.players === 'number'
    && typeof value.difficulty === 'number'
    && typeof value.hand_count === 'number'
    && Array.isArray(value.demand_items)
    && value.demand_items.every((item) => typeof item === 'string')
  )
}

function isCharacter(value: unknown): value is UpstreamCharacter {
  return (
    isRecord(value)
    && typeof value.color === 'number'
    && typeof value.headwear === 'number'
    && typeof value.hairstyle === 'number'
  )
}

function isVector2(value: unknown): value is [number, number] {
  return Array.isArray(value) && value.length === 2 && value.every((part) => typeof part === 'number')
}

function isItemLocation(value: unknown): value is UpstreamItemLocation {
  return (
    isRecord(value)
    && ((Array.isArray(value.tile) && isVector2(value.tile)) || (
      Array.isArray(value.player)
      && value.player.length === 2
      && value.player.every((part) => typeof part === 'number')
    ))
  )
}

function isBootstrapPacket(value: unknown): value is UpstreamBootstrapPacket {
  if (!isRecord(value) || typeof value.type !== 'string') return false

  switch (value.type) {
    case 'version':
      return typeof value.major === 'number' && typeof value.minor === 'number'
    case 'server_data':
      return (
        typeof value.name === 'string'
        && Array.isArray(value.maps)
        && value.maps.every(isMapMetadata)
        && Array.isArray(value.bot_algos)
        && value.bot_algos.every((algo) => typeof algo === 'string')
        && (value.motd === undefined || typeof value.motd === 'string')
      )
    case 'game_data':
      return (
        isMapMetadata(value.metadata)
        && Array.isArray(value.item_names)
        && value.item_names.every((item) => typeof item === 'string')
        && Array.isArray(value.tile_names)
        && value.tile_names.every((tile) => typeof tile === 'string')
        && Array.isArray(value.tile_collide)
        && value.tile_collide.every((tile) => typeof tile === 'number')
        && isRecord(value.tile_placeable_items)
        && Object.values(value.tile_placeable_items).every(
          (items) => Array.isArray(items) && items.every((item) => typeof item === 'number'),
        )
        && Array.isArray(value.tile_placeable_any)
        && value.tile_placeable_any.every((tile) => typeof tile === 'number')
        && Array.isArray(value.tile_interactable_empty)
        && value.tile_interactable_empty.every((tile) => typeof tile === 'number')
        && typeof value.hand_count === 'number'
        && typeof value.is_lobby === 'boolean'
      )
    case 'update_map':
      return Array.isArray(value.changes)
    case 'set_item':
      return isItemLocation(value.location) && (value.item === null || typeof value.item === 'number')
    case 'score':
      return (
        typeof value.points === 'number'
        && typeof value.demands_failed === 'number'
        && typeof value.demands_completed === 'number'
        && typeof value.time_remaining === 'number'
        && typeof value.players === 'number'
        && typeof value.active_recipes === 'number'
        && typeof value.passive_recipes === 'number'
        && typeof value.instant_recipes === 'number'
        && typeof value.stars === 'number'
      )
    case 'set_ingame':
      return typeof value.state === 'boolean'
    case 'joined':
      return typeof value.id === 'number'
    case 'add_player':
      return (
        typeof value.id === 'number'
        && typeof value.name === 'string'
        && Array.isArray(value.position)
        && value.position.length === 2
        && value.position.every((part) => typeof part === 'number')
        && isCharacter(value.character)
        && (value.class === 'chef' || value.class === 'bot' || value.class === 'customer' || value.class === 'tram')
      )
    default:
      return false
  }
}

export function isUpstreamBootstrapPayload(value: unknown): value is UpstreamBootstrapPayload {
  return (
    isRecord(value)
    && value.type === 'forkorfry:local-bootstrap'
    && value.version === UPSTREAM_BRIDGE_PROTOCOL_VERSION
    && typeof value.sessionId === 'string'
    && typeof value.map === 'string'
    && typeof value.playerId === 'number'
    && typeof value.generatedAt === 'string'
    && Array.isArray(value.packets)
    && value.packets.every(isBootstrapPacket)
  )
}

export function createBridgeBootstrapMessage(payload: UpstreamBootstrapPayload): UpstreamParentToEmbeddedMessage {
  return {
    type: 'forkorfry:bridge-bootstrap',
    version: UPSTREAM_BRIDGE_PROTOCOL_VERSION,
    payload,
  }
}

export function createBridgeResumeMessage(payload: UpstreamBootstrapPayload): UpstreamParentToEmbeddedMessage {
  return {
    type: 'forkorfry:bridge-resume',
    version: UPSTREAM_BRIDGE_PROTOCOL_VERSION,
    payload,
  }
}

export function createBridgePauseMessage(reason: string): UpstreamParentToEmbeddedMessage {
  return {
    type: 'forkorfry:bridge-pause',
    version: UPSTREAM_BRIDGE_PROTOCOL_VERSION,
    reason,
  }
}

export function createGameplayPacketMessage(action: UpstreamGameplayAction, payload: Record<string, unknown>): UpstreamGameplayPacket {
  return {
    type: 'forkorfry:bridge-gameplay-packet',
    version: UPSTREAM_BRIDGE_PROTOCOL_VERSION,
    action,
    payload,
  }
}

export function createBridgeAuthorityPacketsMessage(packets: UpstreamAuthorityPacket[]): UpstreamParentToEmbeddedMessage {
  return {
    type: 'forkorfry:bridge-authority-packets',
    version: UPSTREAM_BRIDGE_PROTOCOL_VERSION,
    packets,
  }
}

export function isUpstreamEmbeddedToParentMessage(value: unknown): value is UpstreamEmbeddedToParentMessage {
  if (!isRecord(value) || value.version !== UPSTREAM_BRIDGE_PROTOCOL_VERSION || typeof value.type !== 'string') {
    return false
  }

  switch (value.type) {
    case 'forkorfry:bridge-ready':
      return true
    case 'forkorfry:bridge-bootstrap-ack':
      return typeof value.sessionId === 'string' && typeof value.packetCount === 'number'
    case 'forkorfry:bridge-error':
      return typeof value.detail === 'string'
    case 'forkorfry:bridge-gameplay-packet':
      return (
        (value.action === 'movement' || value.action === 'interact' || value.action === 'ready' || value.action === 'idle')
        && isRecord(value.payload)
      )
    default:
      return false
  }
}
