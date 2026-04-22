import { describe, expect, it } from 'vitest'

import {
  createBridgeBootstrapMessage,
  createLocalBootstrapPayload,
  createGameplayPacketMessage,
  type UpstreamBootstrapPacket,
  UPSTREAM_PROTOCOL_MAJOR,
  isUpstreamBootstrapPayload,
  isUpstreamEmbeddedToParentMessage,
} from '../src/features/runtime-frame/upstream-bridge'
import { createUpstreamRuntimeCheckpoint, restoreUpstreamRuntimeCheckpoint } from '../src/features/runtime-frame/upstream-checkpoint'
import { normalizeUpstreamExportManifest, resolveUpstreamExportUrl } from '../src/features/runtime-frame/upstream-export'
import { createInitialUpstreamRuntimeState } from '../src/features/runtime-frame/upstream-runtime-state'

describe('upstream runtime helpers', () => {
  function getPacket<TType extends UpstreamBootstrapPacket['type']>(
    packets: UpstreamBootstrapPacket[],
    type: TType,
  ): Extract<UpstreamBootstrapPacket, { type: TType }> {
    const packet = packets.find((entry) => entry.type === type)
    if (!packet) throw new Error(`Missing packet: ${type}`)
    return packet as Extract<UpstreamBootstrapPacket, { type: TType }>
  }

  it('restores a valid upstream runtime checkpoint', () => {
    const state = {
      ...createInitialUpstreamRuntimeState(),
      sessionId: 'session-123',
      phase: 'running' as const,
      exportState: 'loaded' as const,
      exportUrl: '/upstream/hurrycurry-web/index.html',
      detail: 'Bundled export iframe loaded.',
      bridgeSnapshot: {
        payload: createLocalBootstrapPayload('session-123'),
        acknowledgedSessionId: 'session-123',
        acknowledgedPacketCount: 8,
        lastError: null,
      },
      godotBridgeSnapshot: {
        entryState: 'entry-ready',
        multiplayerState: 'multiplayer-bridge:connected',
        lastUpdate: 'multiplayer',
        updatedAt: '2026-04-21T00:00:00.000Z',
      },
      bootstrapPacketCount: 8,
    }

    const checkpoint = createUpstreamRuntimeCheckpoint('burger-runtime', state)
    const restored = restoreUpstreamRuntimeCheckpoint('burger-runtime', checkpoint)

    expect(restored).toEqual(state)
  })

  it('falls back to the initial state for an invalid checkpoint', () => {
    const restored = restoreUpstreamRuntimeCheckpoint('burger-runtime', {
      version: 1,
      runtimeId: 'burger-runtime',
      updatedAt: Date.now(),
      state: { phase: 'running' },
    })

    expect(restored).toEqual(createInitialUpstreamRuntimeState())
  })

  it('normalizes the upstream export manifest', () => {
    const manifest = normalizeUpstreamExportManifest({
      htmlEntry: 'index.html',
      files: ['index.html', 'game.js', 'game.wasm'],
      generatedAt: '2026-04-21T00:00:00.000Z',
      sourceDir: '/tmp/hurrycurry-web',
    })

    expect(manifest).toEqual({
      htmlEntry: 'index.html',
      files: ['index.html', 'game.js', 'game.wasm'],
      generatedAt: '2026-04-21T00:00:00.000Z',
      sourceDir: '/tmp/hurrycurry-web',
    })
  })

  it('resolves the export entry url', () => {
    const url = resolveUpstreamExportUrl({
      htmlEntry: 'index.html',
      files: ['index.html'],
      generatedAt: null,
      sourceDir: null,
    })

    expect(url).toBe('/upstream/hurrycurry-web/index.html')
  })

  it('creates a local bootstrap payload for the single-player upstream bridge', () => {
    const payload = createLocalBootstrapPayload('session-123')
    const gameData = getPacket(payload.packets, 'game_data')
    const updateMap = getPacket(payload.packets, 'update_map')
    const addPlayer = getPacket(payload.packets, 'add_player')

    expect(payload.sessionId).toBe('session-123')
    expect(payload.map).toBe('burgers_inc')
    expect(payload.playerId).toBe(1)
    expect(payload.packets[0]).toMatchObject({ type: 'version', major: UPSTREAM_PROTOCOL_MAJOR, minor: 0 })
    expect(payload.packets.map((packet) => packet.type)).toEqual([
      'version',
      'server_data',
      'game_data',
      'update_map',
      'score',
      'set_ingame',
      'joined',
      'add_player',
    ])

    expect(gameData).toMatchObject({
      type: 'game_data',
      metadata: {
        name: 'burgers_inc',
        display_name: 'Burgers, Inc.',
        players: 2,
        difficulty: 2,
        hand_count: 2,
      },
      hand_count: 2,
      is_lobby: false,
    })
    expect(gameData.item_names).toContain('plate')
    expect(gameData.item_names).toContain('bun')
    expect(gameData.tile_names).toContain('floor')
    expect(gameData.tile_names).toContain('counter-window:red')
    expect(gameData.tile_names).toContain('crate:tomato')
    expect(gameData.tile_names).toContain('wall:red')
    expect(gameData.tile_collide.length).toBeGreaterThan(0)
    expect(gameData.tile_placeable_any.length).toBeGreaterThan(0)
    expect(gameData.tile_interactable_empty.length).toBeGreaterThan(0)
    expect(Object.keys(gameData.tile_placeable_items).length).toBeGreaterThan(0)

    expect(updateMap).toMatchObject({ type: 'update_map' })
    expect(updateMap.changes.length).toBeGreaterThan(20)
    expect(updateMap.changes).toContainEqual([[3, 9], expect.any(Array)])

    expect(addPlayer).toMatchObject({
      type: 'add_player',
      id: 1,
      name: 'Chef',
      position: [2.5, 9.5],
      class: 'chef',
    })
  })

  it('validates saved bootstrap payloads', () => {
    expect(isUpstreamBootstrapPayload(createLocalBootstrapPayload('session-123'))).toBe(true)
    expect(isUpstreamBootstrapPayload({ type: 'forkorfry:local-bootstrap', version: 1, packets: [] })).toBe(false)
  })

  it('wraps bootstrap payloads in a parent-to-iframe bridge message', () => {
    const payload = createLocalBootstrapPayload('session-123')

    expect(createBridgeBootstrapMessage(payload)).toEqual({
      type: 'forkorfry:bridge-bootstrap',
      version: 1,
      payload,
    })
  })

  it('validates embedded-runtime bridge messages', () => {
    expect(isUpstreamEmbeddedToParentMessage({
      type: 'forkorfry:bridge-ready',
      version: 1,
    })).toBe(true)

    expect(isUpstreamEmbeddedToParentMessage({
      type: 'forkorfry:bridge-bootstrap-ack',
      version: 1,
      sessionId: 'session-123',
      packetCount: 8,
    })).toBe(true)

    expect(isUpstreamEmbeddedToParentMessage({
      type: 'forkorfry:bridge-error',
      version: 1,
      detail: 'bad bridge',
    })).toBe(true)

    expect(isUpstreamEmbeddedToParentMessage({
      type: 'forkorfry:bridge-bootstrap-ack',
      version: 1,
      sessionId: 42,
      packetCount: 8,
    })).toBe(false)

    expect(isUpstreamEmbeddedToParentMessage(createGameplayPacketMessage('movement', {
      player: 1,
      pos: [2.5, 9.5],
      dir: [0, 1],
      boost: false,
    }))).toBe(true)
  })
})
