import { BURGERS_INC_BOOTSTRAP } from '../../../upstream/generated/burgers-inc-bootstrap'
import type { UpstreamAuthorityPacket, UpstreamGameplayPacket } from './upstream-bridge'

export interface UpstreamAuthoritySnapshot {
  playerId: number
  position: [number, number]
  direction: [number, number]
  rotation: number
  boost: boolean
}

export interface UpstreamLocalAuthoritySession {
  snapshot: UpstreamAuthoritySnapshot
}

export function createInitialAuthoritySnapshot(): UpstreamAuthoritySnapshot {
  return {
    playerId: BURGERS_INC_BOOTSTRAP.playerId,
    position: [...BURGERS_INC_BOOTSTRAP.spawnPosition],
    direction: [0, 0],
    rotation: 0,
    boost: false,
  }
}

export function createLocalAuthoritySession(snapshot?: UpstreamAuthoritySnapshot | null): UpstreamLocalAuthoritySession {
  return {
    snapshot: snapshot ?? createInitialAuthoritySnapshot(),
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

export function applyGameplayPacketToAuthority(
  session: UpstreamLocalAuthoritySession,
  packet: UpstreamGameplayPacket,
) {
  if (packet.action !== 'movement') {
    return { session, packets: [] as UpstreamAuthorityPacket[] }
  }

  const playerId = typeof packet.payload.player === 'number' ? packet.payload.player : session.snapshot.playerId
  const position = isVector2(packet.payload.pos) ? packet.payload.pos : session.snapshot.position
  const direction = isVector2(packet.payload.dir) ? packet.payload.dir : session.snapshot.direction
  const boost = typeof packet.payload.boost === 'boolean' ? packet.payload.boost : session.snapshot.boost

  const snapshot: UpstreamAuthoritySnapshot = {
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
