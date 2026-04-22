import { describe, expect, it } from 'vitest'

import {
  createBridgeBootstrapMessage,
  createLocalBootstrapPayload,
  createGameplayPacketMessage,
  type UpstreamBootstrapPacket,
  isUpstreamBootstrapPayload,
  isUpstreamEmbeddedToParentMessage,
} from '../src/features/runtime-frame/upstream-bridge'
import { BURGERS_INC_BOOTSTRAP } from '../upstream/generated/burgers-inc-bootstrap'
import { createUpstreamRuntimeCheckpoint, restoreUpstreamRuntimeCheckpoint } from '../src/features/runtime-frame/upstream-checkpoint'
import { normalizeUpstreamExportManifest, resolveUpstreamExportUrl } from '../src/features/runtime-frame/upstream-export'
import { createInitialUpstreamRuntimeState, describeUpstreamRuntimeSession } from '../src/features/runtime-frame/upstream-runtime-state'
import { UPSTREAM_RUNTIME_GAMEPLAY_PACKET_HISTORY_LIMIT } from '../src/features/runtime-frame/upstream-runtime-state'

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
      gameplayPackets: [
        { action: 'movement', payload: { x: 1 }, receivedAt: '2026-04-21T00:00:00.000Z' },
        { action: 'interact', payload: { target: 'bun' }, receivedAt: '2026-04-21T00:00:01.000Z' },
      ],
      gameplayPacketSummary: {
        totalCount: 2,
        lastAction: 'interact',
        actionCounts: { movement: 1, interact: 1 },
      },
      godotBridgeSnapshot: {
        entryState: 'entry-ready',
        lastUpdate: 'multiplayer',
        updatedAt: '2026-04-21T00:00:00.000Z',
      },
      lastCheckpointReason: 'checkpoint:pause',
      bootstrapPacketCount: 8,
    }

    const checkpoint = createUpstreamRuntimeCheckpoint('burger-runtime', state)
    const restored = restoreUpstreamRuntimeCheckpoint('burger-runtime', checkpoint)

    expect(restored).toEqual({
      ...state,
      lastCheckpointReason: null,
      gameplayPacketSummary: {
        totalCount: 2,
        lastAction: 'interact',
        actionCounts: { movement: 1, interact: 1 },
      },
    })
  })

  it('recomputes gameplay packet summary on restore', () => {
    const restored = restoreUpstreamRuntimeCheckpoint('burger-runtime', {
      version: 1,
      runtimeId: 'burger-runtime',
      updatedAt: Date.now(),
      state: {
        ...createInitialUpstreamRuntimeState(),
        gameplayPackets: [
          { action: 'movement', payload: {}, receivedAt: '2026-04-21T00:00:00.000Z' },
          { action: 'ready', payload: {}, receivedAt: '2026-04-21T00:00:01.000Z' },
        ],
        gameplayPacketSummary: {
          totalCount: 99,
          lastAction: 'stale',
          actionCounts: { stale: 99 },
        },
        lastCheckpointReason: 'stale-checkpoint',
      },
    })

    expect(restored.gameplayPacketSummary).toEqual({
      totalCount: 2,
      lastAction: 'ready',
      actionCounts: { movement: 1, ready: 1 },
    })
    expect(restored.lastCheckpointReason).toBeNull()
  })

  it('preserves godot bridge snapshot data on restore without bridge acknowledgement coupling', () => {
    const restored = restoreUpstreamRuntimeCheckpoint('burger-runtime', {
      version: 1,
      runtimeId: 'burger-runtime',
      updatedAt: Date.now(),
      state: {
        ...createInitialUpstreamRuntimeState(),
        bridgeSnapshot: {
          payload: createLocalBootstrapPayload('session-123'),
          acknowledgedSessionId: null,
          acknowledgedPacketCount: 0,
          lastError: null,
        },
        godotBridgeSnapshot: {
          entryState: 'live',
          lastUpdate: 'bridge-update',
          updatedAt: '2026-04-21T00:00:00.000Z',
        },
      },
    })

    expect(restored.godotBridgeSnapshot).toEqual({
      entryState: 'live',
      lastUpdate: 'bridge-update',
      updatedAt: '2026-04-21T00:00:00.000Z',
    })
  })

  it('scrubs missing godot bridge snapshot data on restore', () => {
    const restored = restoreUpstreamRuntimeCheckpoint('burger-runtime', {
      version: 1,
      runtimeId: 'burger-runtime',
      updatedAt: Date.now(),
      state: {
        ...createInitialUpstreamRuntimeState(),
        godotBridgeSnapshot: undefined as unknown as {
          entryState: string | null
          lastUpdate: string | null
          updatedAt: string | null
        },
      },
    })

    expect(restored.godotBridgeSnapshot).toEqual({
      entryState: null,
      lastUpdate: null,
      updatedAt: null,
    })
  })

  it('caps restored gameplay packet history while preserving the summary window', () => {
    const gameplayPackets = Array.from({ length: UPSTREAM_RUNTIME_GAMEPLAY_PACKET_HISTORY_LIMIT + 5 }, (_, index) => ({
      action: index % 2 === 0 ? 'movement' : 'interact',
      payload: { index },
      receivedAt: `2026-04-21T00:00:${String(index).padStart(2, '0')}.000Z`,
    }))

    const restored = restoreUpstreamRuntimeCheckpoint('burger-runtime', {
      version: 1,
      runtimeId: 'burger-runtime',
      updatedAt: Date.now(),
      state: {
        ...createInitialUpstreamRuntimeState(),
        gameplayPackets,
      },
    })

    expect(restored.gameplayPackets).toHaveLength(UPSTREAM_RUNTIME_GAMEPLAY_PACKET_HISTORY_LIMIT)
    expect(restored.gameplayPackets[0]).toEqual(gameplayPackets[5])
    expect(restored.gameplayPackets[restored.gameplayPackets.length - 1]).toEqual(gameplayPackets[gameplayPackets.length - 1])
    expect(restored.gameplayPacketSummary).toEqual({
      totalCount: UPSTREAM_RUNTIME_GAMEPLAY_PACKET_HISTORY_LIMIT,
      lastAction: 'interact',
      actionCounts: {
        movement: 12,
        interact: 13,
      },
    })
  })

  it('ignores malformed gameplay packets when restoring a checkpoint', () => {
    const restored = restoreUpstreamRuntimeCheckpoint('burger-runtime', {
      version: 1,
      runtimeId: 'burger-runtime',
      updatedAt: Date.now(),
      state: {
        ...createInitialUpstreamRuntimeState(),
        gameplayPackets: [
          { action: 'movement', payload: { x: 1 }, receivedAt: '2026-04-21T00:00:00.000Z' },
          { action: null, payload: { x: 2 }, receivedAt: '2026-04-21T00:00:01.000Z' } as unknown as { action: string, payload: Record<string, unknown>, receivedAt: string },
          { payload: { x: 3 }, receivedAt: '2026-04-21T00:00:02.000Z' } as unknown as { action: string, payload: Record<string, unknown>, receivedAt: string },
          null as unknown as { action: string, payload: Record<string, unknown>, receivedAt: string },
          { action: 'ready', payload: {}, receivedAt: '2026-04-21T00:00:03.000Z' },
        ],
      },
    })

    expect(restored.gameplayPacketSummary).toEqual({
      totalCount: 5,
      lastAction: 'ready',
      actionCounts: { movement: 1, ready: 1 },
    })
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

  it('rebuilds gameplay packet summary for older checkpoints', () => {
    const restored = restoreUpstreamRuntimeCheckpoint('burger-runtime', {
      version: 1,
      runtimeId: 'burger-runtime',
      updatedAt: Date.now(),
      state: {
        ...createInitialUpstreamRuntimeState(),
        gameplayPackets: [
          { action: 'movement', payload: {}, receivedAt: '2026-04-21T00:00:00.000Z' },
          { action: 'movement', payload: {}, receivedAt: '2026-04-21T00:00:01.000Z' },
          { action: 'ready', payload: {}, receivedAt: '2026-04-21T00:00:02.000Z' },
        ],
      },
    })

    expect(restored.gameplayPacketSummary).toEqual({
      totalCount: 3,
      lastAction: 'ready',
      actionCounts: { movement: 2, ready: 1 },
    })
  })

  it('describes reused runtime sessions distinctly from fresh boots', () => {
    expect(describeUpstreamRuntimeSession('session-123', true)).toBe('Reusing checkpointed session session-1.')
    expect(describeUpstreamRuntimeSession('session-123', false)).toBe('Boot accepted for session-1.')
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
    expect(payload.packets[0]).toMatchObject({
      type: 'version',
      major: BURGERS_INC_BOOTSTRAP.packets[0].type === 'version' ? BURGERS_INC_BOOTSTRAP.packets[0].major : undefined,
      minor: 0,
    })
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
