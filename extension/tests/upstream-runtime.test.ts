import { describe, expect, it } from 'vitest'

import {
  createBridgeAuthorityPacketsMessage,
  createBridgeBootstrapMessage,
  createGameplayPacketMessage,
  type UpstreamBootstrapPacket,
  isUpstreamBootstrapPayload,
  isUpstreamEmbeddedToParentMessage,
} from '../src/features/runtime-frame/upstream-bridge'
import { BURGERS_INC_BOOTSTRAP, createBurgersIncBootstrapPayload, createBurgersIncBootstrapTemplate } from '../upstream/generated/burgers-inc-bootstrap'
import { createUpstreamRuntimeCheckpoint, restoreUpstreamRuntimeCheckpoint } from '../src/features/runtime-frame/upstream-checkpoint'
import { normalizeUpstreamExportManifest, resolveUpstreamExportUrl } from '../src/features/runtime-frame/upstream-export'
import { advanceAuthoritySession, applyGameplayPacketToAuthority, createAuthorityMovementPacket, createAuthorityStatePackets, createInitialAuthoritySnapshot, createLocalAuthoritySession } from '../src/features/runtime-frame/local-authority'
import { acknowledgeUpstreamBridgeSnapshot, createBootUpstreamRuntimeState, createInitialUpstreamBridgeSnapshot, createInitialUpstreamRuntimeState, createResumeUpstreamRuntimeState, describeUpstreamRuntimeSession, errorUpstreamBridgeSnapshot, resolveUpstreamRuntimeSessionState, restoreUpstreamBridgeSnapshotForSession } from '../src/features/runtime-frame/upstream-runtime-state'
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
      authoritySnapshot: {
        playerId: 1,
        position: [4.5, 7.5],
        direction: [1, 0],
        rotation: Math.PI / 2,
        boost: true,
        hands: [2, null],
        tileItems: { '4,7': null, '5,7': 3 },
        progressTiles: {
          '6,7': {
            position: 0.5,
            speed: 0.5,
            baseSpeed: 0.5,
            warn: false,
            players: [1],
            hand: 0,
            handOutput: 15,
            tileOutput: null,
          },
        },
        interaction: { hand: 0, tile: [6, 7] },
        score: {
          points: 9,
          demands_failed: 0,
          demands_completed: 1,
          time_remaining: 0,
          players: 1,
          active_recipes: 0,
          passive_recipes: 0,
          instant_recipes: 0,
          stars: 0,
        },
        customer: {
          id: 2,
          position: [4.5, 12.5],
          chair: [4, 12],
          table: [4, 11],
          phase: 'eating',
          handItem: BURGERS_INC_BOOTSTRAP.item_names.indexOf('plate:seared-patty,sliced-bun,sliced-cheese'),
          demandItem: BURGERS_INC_BOOTSTRAP.item_names.indexOf('plate:seared-patty,sliced-bun,sliced-cheese'),
          demandOutput: BURGERS_INC_BOOTSTRAP.item_names.indexOf('dirty-plate'),
          demandDuration: 10,
          orderMessage: null,
          orderTimeout: null,
          scorePending: false,
          timerRemaining: 3,
          despawnPending: false,
          character: { color: 0, headwear: 0, hairstyle: 0 },
        },
      },
      lastCheckpointReason: 'checkpoint:pause',
      bootstrapPacketCount: 8,
    }

    const checkpoint = createUpstreamRuntimeCheckpoint('burger-runtime', state)
    const restored = restoreUpstreamRuntimeCheckpoint('burger-runtime', checkpoint)

    expect(restored).toMatchObject({
      ...state,
      saveVersion: 2,
      lastCheckpointReason: null,
      gameplayPacketSummary: {
        totalCount: 2,
        lastAction: 'interact',
        actionCounts: { movement: 1, interact: 1 },
      },
      authoritySnapshot: {
        ...state.authoritySnapshot,
        tileItems: expect.objectContaining(state.authoritySnapshot.tileItems),
      },
    })
  })

  it('migrates legacy authority checkpoints without customer score state', () => {
    const restored = restoreUpstreamRuntimeCheckpoint('burger-runtime', {
      version: 1,
      runtimeId: 'burger-runtime',
      updatedAt: Date.now(),
      state: {
        ...createInitialUpstreamRuntimeState(),
        saveVersion: 1,
        sessionId: 'legacy-session',
        authoritySnapshot: {
          playerId: 1,
          position: [4.5, 7.5],
          direction: [1, 0],
          rotation: Math.PI / 2,
          boost: true,
          hands: [2, null],
          tileItems: { '4,7': null, '5,7': 3 },
          progressTiles: {},
          interaction: { hand: 0, tile: [6, 7] },
        },
      },
    })

    expect(restored.saveVersion).toBe(2)
    expect(restored.authoritySnapshot).toMatchObject({
      playerId: 1,
      position: [4.5, 7.5],
      direction: [1, 0],
      rotation: Math.PI / 2,
      boost: true,
      hands: [2, null],
      tileItems: { '4,7': null, '5,7': 3 },
      progressTiles: {},
      interaction: { hand: 0, tile: [6, 7] },
      score: createInitialAuthoritySnapshot().score,
      customer: createInitialAuthoritySnapshot().customer,
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
      totalCount: 2,
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

  it('restores bridge snapshot state only for the active session', () => {
    expect(restoreUpstreamBridgeSnapshotForSession({
      acknowledgedSessionId: 'session-123',
      acknowledgedPacketCount: 8,
      lastError: 'stale',
    }, 'session-123')).toEqual({
      acknowledgedSessionId: 'session-123',
      acknowledgedPacketCount: 8,
      lastError: null,
    })

    expect(restoreUpstreamBridgeSnapshotForSession({
      acknowledgedSessionId: 'session-123',
      acknowledgedPacketCount: 8,
      lastError: 'stale',
    }, 'session-999')).toEqual(createInitialUpstreamBridgeSnapshot())
  })

  it('resolves runtime session state from a bridge snapshot in one place', () => {
    expect(resolveUpstreamRuntimeSessionState({
      acknowledgedSessionId: 'session-123',
      acknowledgedPacketCount: 8,
      lastError: 'stale',
    }, 'session-123')).toEqual({
      sessionId: 'session-123',
      reused: true,
      bridgeSnapshot: {
        acknowledgedSessionId: 'session-123',
        acknowledgedPacketCount: 8,
        lastError: null,
      },
    })

    expect(resolveUpstreamRuntimeSessionState({
      acknowledgedSessionId: 'session-123',
      acknowledgedPacketCount: 8,
      lastError: 'stale',
    }, 'session-999')).toEqual({
      sessionId: 'session-999',
      reused: false,
      bridgeSnapshot: createInitialUpstreamBridgeSnapshot(),
    })
  })

  it('updates bridge snapshot ack and error state through shared helpers', () => {
    const acknowledged = acknowledgeUpstreamBridgeSnapshot(createInitialUpstreamBridgeSnapshot(), 'session-123', 8)

    expect(acknowledged).toEqual({
      acknowledgedSessionId: 'session-123',
      acknowledgedPacketCount: 8,
      lastError: null,
    })

    expect(errorUpstreamBridgeSnapshot(acknowledged, 'bad bridge')).toEqual({
      acknowledgedSessionId: 'session-123',
      acknowledgedPacketCount: 8,
      lastError: 'bad bridge',
    })
  })

  it('creates boot state from restored state with active-session reuse rules', () => {
    const restored = {
      ...createInitialUpstreamRuntimeState(),
      sessionId: 'old-session',
      bridgeState: 'acknowledged' as const,
      bridgeSnapshot: {
        acknowledgedSessionId: 'session-123',
        acknowledgedPacketCount: 8,
        lastError: 'stale',
      },
    }

    expect(createBootUpstreamRuntimeState(restored, 'session-123', 8)).toMatchObject({
      sessionId: 'session-123',
      phase: 'booting',
      bridgeState: 'waiting',
      bootstrapPacketCount: 8,
      bridgeSnapshot: {
        acknowledgedSessionId: 'session-123',
        acknowledgedPacketCount: 8,
        lastError: null,
      },
      detail: 'Reusing checkpointed session session-1.',
    })

    expect(createBootUpstreamRuntimeState(restored, 'session-999', 8)).toMatchObject({
      sessionId: 'session-999',
      bridgeSnapshot: createInitialUpstreamBridgeSnapshot(),
      detail: 'Boot accepted for session-9.',
    })
  })

  it('creates resume state from restored state with fallback session handling', () => {
    const restored = {
      ...createInitialUpstreamRuntimeState(),
      sessionId: '',
      exportUrl: '/upstream/hurrycurry-web/index.html',
      bridgeState: 'acknowledged' as const,
      bridgeSnapshot: {
        acknowledgedSessionId: 'session-123',
        acknowledgedPacketCount: 8,
        lastError: 'stale',
      },
    }

    expect(createResumeUpstreamRuntimeState(restored, 'session-123')).toMatchObject({
      sessionId: 'session-123',
      phase: 'running',
      bridgeState: 'waiting',
      bridgeSnapshot: {
        acknowledgedSessionId: 'session-123',
        acknowledgedPacketCount: 8,
        lastError: null,
      },
      detail: 'Reusing checkpointed session session-1.',
    })

    expect(createResumeUpstreamRuntimeState({
      ...restored,
      exportUrl: null,
      bridgeState: 'error',
      bridgeSnapshot: createInitialUpstreamBridgeSnapshot(),
    }, 'session-999')).toMatchObject({
      sessionId: 'session-999',
      phase: 'ready',
      bridgeState: 'idle',
      detail: 'Ready.',
    })
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
    const payload = createBurgersIncBootstrapPayload('session-123', 1)
    const gameData = getPacket(payload.packets, 'game_data')
    const updateMap = getPacket(payload.packets, 'update_map')
    const addPlayer = getPacket(payload.packets, 'add_player')
    const setItemPackets = payload.packets.filter((packet) => packet.type === 'set_item')
    const plateIndex = gameData.item_names.indexOf('plate')
    const panIndex = gameData.item_names.indexOf('pan')

    expect(payload.sessionId).toBe('session-123')
    expect(payload.map).toBe('burgers_inc')
    expect(payload.playerId).toBe(1)
    expect(payload.packets[0]).toMatchObject({
      type: 'version',
      major: BURGERS_INC_BOOTSTRAP.packets[0].type === 'version' ? BURGERS_INC_BOOTSTRAP.packets[0].major : undefined,
      minor: 0,
    })
    expect(payload.packets.slice(0, 4).map((packet) => packet.type)).toEqual([
      'version',
      'server_data',
      'game_data',
      'update_map',
    ])
    expect(payload.packets.slice(-4).map((packet) => packet.type)).toEqual([
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
    expect(gameData.item_names).toContain('unknown-order')
    expect(gameData.item_names).toContain('bun')
    expect(gameData.metadata.demand_items).toContain('plate:seared-patty,sliced-bun,sliced-cheese')
    expect(gameData.metadata.demand_items).toContain('plate:sliced-lettuce,sliced-tomato')
    expect(gameData.metadata.demand_items).toContain('plate:seared-patty,sliced-bun,sliced-lettuce,sliced-tomato')
    expect(gameData.metadata.demand_items).toContain('plate:seared-patty,sliced-bun,sliced-cheese,sliced-tomato')
    expect(gameData.metadata.demand_items).toContain('plate:french-fries')
    expect(gameData.metadata.demand_items).toContain('plate:seared-steak')
    expect(gameData.metadata.demand_items).toContain('plate:french-fries,seared-steak')
    expect(gameData.item_names).toContain('plate:sliced-lettuce,sliced-tomato')
    expect(gameData.item_names).toContain('plate:seared-patty,sliced-bun,sliced-lettuce,sliced-tomato')
    expect(gameData.item_names).toContain('plate:seared-patty,sliced-bun,sliced-cheese,sliced-tomato')
    expect(gameData.item_names).toContain('pan:steak')
    expect(gameData.item_names).toContain('pan:seared-steak')
    expect(gameData.item_names).toContain('basket:sliced-potato')
    expect(gameData.item_names).toContain('basket:french-fries')
    expect(gameData.item_names).toContain('basket:burned')
    expect(gameData.item_names).toContain('plate:french-fries,seared-steak')
    expect(gameData.tile_names).toContain('floor')
    expect(gameData.tile_names).toContain('counter-window:red')
    expect(gameData.tile_names).toContain('crate:tomato')
    expect(gameData.tile_names).toContain('wall:red')
    expect(gameData.tile_collide.length).toBeGreaterThan(0)
    expect(gameData.tile_placeable_any.length).toBeGreaterThan(0)
    expect(gameData.tile_interactable_empty.length).toBeGreaterThan(0)
    expect(Object.keys(gameData.tile_placeable_items).length).toBeGreaterThan(0)
    expect(gameData.tile_interactable_empty).toContain(gameData.tile_names.indexOf('crate:steak'))
    expect(gameData.tile_interactable_empty).toContain(gameData.tile_names.indexOf('sink'))

    expect(updateMap).toMatchObject({ type: 'update_map' })
    expect(updateMap.changes.length).toBeGreaterThan(20)
    expect(updateMap.changes).toContainEqual([[3, 9], expect.any(Array)])
    expect(setItemPackets.length).toBeGreaterThan(0)
    expect(setItemPackets).toContainEqual({
      type: 'set_item',
      location: expect.objectContaining({ tile: expect.any(Array) }),
      item: plateIndex,
    })
    expect(setItemPackets).toContainEqual({
      type: 'set_item',
      location: expect.objectContaining({ tile: expect.any(Array) }),
      item: panIndex,
    })

    expect(addPlayer).toMatchObject({
      type: 'add_player',
      id: 1,
      name: 'Chef',
      position: [2.5, 9.5],
      class: 'chef',
    })
  })

  it('applies movement gameplay packets through the local authority session', () => {
    const session = createLocalAuthoritySession()
    const result = applyGameplayPacketToAuthority(session, createGameplayPacketMessage('movement', {
      player: 1,
      pos: [4.5, 8.5],
      dir: [0, 1],
      boost: true,
    }))

    expect(result.session.snapshot).toMatchObject({
      playerId: 1,
      position: [4.5, 8.5],
      direction: [0, 1],
      rotation: 0,
      boost: true,
    })
    expect(result.session.snapshot.hands).toEqual([null, null])
    expect(Object.keys(result.session.snapshot.tileItems).length).toBeGreaterThan(0)
    expect(result.packets).toEqual([
      {
        type: 'movement',
        player: 1,
        pos: [4.5, 8.5],
        rot: 0,
        dir: [0, 1],
        boost: true,
        sync: false,
      },
    ])
  })

  it('applies tile pickup and place gameplay packets through the local authority session', () => {
    const session = createLocalAuthoritySession()
    const initialTilePacket = BURGERS_INC_BOOTSTRAP.packets.find((packet) => packet.type === 'set_item' && 'tile' in packet.location && packet.item !== null)
    if (!initialTilePacket || !('tile' in initialTilePacket.location)) throw new Error('Missing initial tile item for pickup test')

    const pickup = applyGameplayPacketToAuthority(session, createGameplayPacketMessage('interact', {
      player: 1,
      hand: 0,
      target: { tile: initialTilePacket.location.tile },
    }))

    expect(pickup.session.snapshot.hands[0]).toBe(initialTilePacket.item)
    expect(pickup.session.snapshot.tileItems[initialTilePacket.location.tile.join(',')]).toBeNull()
    expect(pickup.packets).toEqual([
      {
        type: 'move_item',
        from: { tile: initialTilePacket.location.tile },
        to: { player: [1, 0] },
      },
    ])

    const place = applyGameplayPacketToAuthority(pickup.session, createGameplayPacketMessage('interact', {
      player: 1,
      hand: 0,
      target: { tile: initialTilePacket.location.tile },
    }))

    expect(place.session.snapshot.hands[0]).toBeNull()
    expect(place.session.snapshot.tileItems[initialTilePacket.location.tile.join(',')]).toBe(initialTilePacket.item)
    expect(place.packets).toEqual([
      {
        type: 'move_item',
        from: { player: [1, 0] },
        to: { tile: initialTilePacket.location.tile },
      },
    ])
  })

  it('dispenses and returns renewable source items without depleting the source tile', () => {
    const steakIndex = BURGERS_INC_BOOTSTRAP.item_names.indexOf('steak')
    const crateTile = BURGERS_INC_BOOTSTRAP.changes.find(([_, tileIndexes]) => tileIndexes.some((tileIndex) => BURGERS_INC_BOOTSTRAP.tile_names[tileIndex] === 'crate:steak'))
    if (steakIndex < 0 || !crateTile) throw new Error('Missing crate fixture')

    const session = createLocalAuthoritySession()
    const dispensed = applyGameplayPacketToAuthority(session, createGameplayPacketMessage('interact', {
      player: 1,
      hand: 0,
      target: { tile: crateTile[0] },
    }))

    expect(dispensed.session.snapshot.hands[0]).toBe(steakIndex)
    expect(dispensed.session.snapshot.tileItems[crateTile[0].join(',')] ?? null).toBeNull()
    expect(dispensed.session.snapshot.score.points).toBe(-1)
    expect(dispensed.packets).toEqual([
      {
        type: 'set_item',
        location: { player: [1, 0] },
        item: steakIndex,
      },
      {
        type: 'score',
        ...dispensed.session.snapshot.score,
      },
    ])

    const returned = applyGameplayPacketToAuthority(dispensed.session, createGameplayPacketMessage('interact', {
      player: 1,
      hand: 0,
      target: { tile: crateTile[0] },
    }))

    expect(returned.session.snapshot.hands[0]).toBeNull()
    expect(returned.session.snapshot.tileItems[crateTile[0].join(',')] ?? null).toBeNull()
    expect(returned.session.snapshot.score.points).toBe(0)
    expect(returned.packets).toEqual([
      {
        type: 'set_item',
        location: { player: [1, 0] },
        item: null,
      },
      {
        type: 'score',
        ...returned.session.snapshot.score,
      },
    ])
  })

  it('dispenses renewable plates without depleting the plate source tile', () => {
    const plateIndex = BURGERS_INC_BOOTSTRAP.item_names.indexOf('plate')
    const plateTilePacket = BURGERS_INC_BOOTSTRAP.packets.find((packet) => packet.type === 'set_item' && 'tile' in packet.location && packet.item === plateIndex)
    if (plateIndex < 0 || !plateTilePacket || !('tile' in plateTilePacket.location)) throw new Error('Missing plate source fixture')

    const session = createLocalAuthoritySession()
    const dispensed = applyGameplayPacketToAuthority(session, createGameplayPacketMessage('interact', {
      player: 1,
      hand: 0,
      target: { tile: plateTilePacket.location.tile },
    }))

    expect(dispensed.session.snapshot.hands[0]).toBe(plateIndex)
    expect(dispensed.session.snapshot.tileItems[plateTilePacket.location.tile.join(',')]).toBe(plateIndex)
    expect(dispensed.packets).toEqual([
      {
        type: 'set_item',
        location: { player: [1, 0] },
        item: plateIndex,
      },
      {
        type: 'score',
        ...dispensed.session.snapshot.score,
      },
    ])
  })

  it('starts, advances, pauses, and completes cutting-board prep through local authority', () => {
    const tomatoIndex = BURGERS_INC_BOOTSTRAP.item_names.indexOf('tomato')
    const slicedTomatoIndex = BURGERS_INC_BOOTSTRAP.item_names.indexOf('sliced-tomato')
    const cuttingBoard = BURGERS_INC_BOOTSTRAP.changes.find(([_, tileIndexes]) => tileIndexes.some((tileIndex) => BURGERS_INC_BOOTSTRAP.tile_names[tileIndex] === 'cutting-board'))
    if (tomatoIndex < 0 || slicedTomatoIndex < 0 || !cuttingBoard) throw new Error('Missing cutting-board recipe fixture')

    const seededSession = createLocalAuthoritySession({
      ...createInitialAuthoritySnapshot(),
      hands: [tomatoIndex, null],
      tileItems: {
        ...createInitialAuthoritySnapshot().tileItems,
        [cuttingBoard[0].join(',')]: null,
      },
    })

    const started = applyGameplayPacketToAuthority(seededSession, createGameplayPacketMessage('interact', {
      player: 1,
      hand: 0,
      target: { tile: cuttingBoard[0] },
    }))

    expect(started.session.snapshot.hands[0]).toBeNull()
    expect(started.session.snapshot.tileItems[cuttingBoard[0].join(',')]).toBe(tomatoIndex)
    expect(started.session.snapshot.progressTiles[cuttingBoard[0].join(',')]).toMatchObject({
      position: 0,
      speed: 0.5,
      baseSpeed: 0.5,
      players: [1],
      hand: 0,
      handOutput: slicedTomatoIndex,
      tileOutput: null,
    })
    expect(started.packets).toEqual([
      {
        type: 'move_item',
        from: { player: [1, 0] },
        to: { tile: cuttingBoard[0] },
      },
      {
        type: 'set_progress',
        players: [1],
        item: { tile: cuttingBoard[0] },
        position: 0,
        speed: 0.5,
        warn: false,
      },
    ])

    const advanced = advanceAuthoritySession(started.session, 2)
    expect(advanced.session.snapshot.progressTiles[cuttingBoard[0].join(',')].position).toBe(1)

    const paused = applyGameplayPacketToAuthority(advanced.session, createGameplayPacketMessage('interact', {
      player: 1,
      hand: 0,
      target: null,
    }))

    expect(paused.session.snapshot.progressTiles[cuttingBoard[0].join(',')]).toBeUndefined()
    expect(paused.session.snapshot.hands[0]).toBe(slicedTomatoIndex)
    expect(paused.session.snapshot.tileItems[cuttingBoard[0].join(',')]).toBeNull()
    expect(paused.packets).toEqual([
      {
        type: 'set_item',
        location: { tile: cuttingBoard[0] },
        item: null,
      },
      {
        type: 'set_item',
        location: { tile: cuttingBoard[0] },
        item: slicedTomatoIndex,
      },
      {
        type: 'move_item',
        from: { tile: cuttingBoard[0] },
        to: { player: [1, 0] },
      },
    ])
  })

  it('washes a dirty plate at the sink through the active authority path', () => {
    const dirtyPlateIndex = BURGERS_INC_BOOTSTRAP.item_names.indexOf('dirty-plate')
    const plateIndex = BURGERS_INC_BOOTSTRAP.item_names.indexOf('plate')
    const sinkTile = BURGERS_INC_BOOTSTRAP.changes.find(([_, tileIndexes]) => tileIndexes.some((tileIndex) => BURGERS_INC_BOOTSTRAP.tile_names[tileIndex] === 'sink'))
    if (dirtyPlateIndex < 0 || plateIndex < 0 || !sinkTile) throw new Error('Missing sink fixture')

    const seededSession = createLocalAuthoritySession({
      ...createInitialAuthoritySnapshot(),
      hands: [dirtyPlateIndex, null],
      tileItems: {
        ...createInitialAuthoritySnapshot().tileItems,
        [sinkTile[0].join(',')]: null,
      },
    })

    const started = applyGameplayPacketToAuthority(seededSession, createGameplayPacketMessage('interact', {
      player: 1,
      hand: 0,
      target: { tile: sinkTile[0] },
    }))

    expect(started.session.snapshot.hands[0]).toBeNull()
    expect(started.session.snapshot.tileItems[sinkTile[0].join(',')]).toBe(dirtyPlateIndex)
    expect(started.session.snapshot.progressTiles[sinkTile[0].join(',')]).toMatchObject({
      speed: 0.5,
      baseSpeed: 0.5,
      handOutput: plateIndex,
      tileOutput: null,
    })

    const advanced = advanceAuthoritySession(started.session, 2)
    const completed = applyGameplayPacketToAuthority(advanced.session, createGameplayPacketMessage('interact', {
      player: 1,
      hand: 0,
      target: null,
    }))

    expect(completed.session.snapshot.hands[0]).toBe(plateIndex)
    expect(completed.session.snapshot.tileItems[sinkTile[0].join(',')]).toBeNull()
    expect(completed.packets).toEqual([
      {
        type: 'set_item',
        location: { tile: sinkTile[0] },
        item: null,
      },
      {
        type: 'set_item',
        location: { tile: sinkTile[0] },
        item: plateIndex,
      },
      {
        type: 'move_item',
        from: { tile: sinkTile[0] },
        to: { player: [1, 0] },
      },
    ])
  })

  it('combines a held patty into a tile pan through the instant authority path', () => {
    const pattyIndex = BURGERS_INC_BOOTSTRAP.item_names.indexOf('patty')
    const panIndex = BURGERS_INC_BOOTSTRAP.item_names.indexOf('pan')
    const panPattyIndex = BURGERS_INC_BOOTSTRAP.item_names.indexOf('pan:patty')
    const panTilePacket = BURGERS_INC_BOOTSTRAP.packets.find((packet) => packet.type === 'set_item' && 'tile' in packet.location && packet.item === panIndex)
    if (pattyIndex < 0 || panPattyIndex < 0 || !panTilePacket || !('tile' in panTilePacket.location)) throw new Error('Missing pan combine fixture')

    const session = createLocalAuthoritySession({
      ...createInitialAuthoritySnapshot(),
      hands: [pattyIndex, null],
    })

    const combined = applyGameplayPacketToAuthority(session, createGameplayPacketMessage('interact', {
      player: 1,
      hand: 0,
      target: { tile: panTilePacket.location.tile },
    }))

    expect(combined.session.snapshot.hands[0]).toBeNull()
    expect(combined.session.snapshot.tileItems[panTilePacket.location.tile.join(',')]).toBe(panPattyIndex)
    expect(combined.packets).toEqual([
      {
        type: 'set_item',
        location: { tile: panTilePacket.location.tile },
        item: null,
      },
      {
        type: 'move_item',
        from: { player: [1, 0] },
        to: { tile: panTilePacket.location.tile },
      },
      {
        type: 'set_item',
        location: { tile: panTilePacket.location.tile },
        item: null,
      },
      {
        type: 'set_item',
        location: { tile: panTilePacket.location.tile },
        item: panPattyIndex,
      },
    ])
  })

  it('assembles the hidden cheeseburger variant through the plate instant authority path', () => {
    const slicedBunIndex = BURGERS_INC_BOOTSTRAP.item_names.indexOf('sliced-bun')
    const slicedCheeseIndex = BURGERS_INC_BOOTSTRAP.item_names.indexOf('sliced-cheese')
    const panIndex = BURGERS_INC_BOOTSTRAP.item_names.indexOf('pan')
    const panSearedPattyIndex = BURGERS_INC_BOOTSTRAP.item_names.indexOf('pan:seared-patty')
    const plateIndex = BURGERS_INC_BOOTSTRAP.item_names.indexOf('plate')
    const plateBunIndex = BURGERS_INC_BOOTSTRAP.item_names.indexOf('plate:sliced-bun')
    const platePattyBunIndex = BURGERS_INC_BOOTSTRAP.item_names.indexOf('plate:seared-patty,sliced-bun')
    const finalBurgerIndex = BURGERS_INC_BOOTSTRAP.item_names.indexOf('plate:seared-patty,sliced-bun,sliced-cheese')
    const plateTilePacket = BURGERS_INC_BOOTSTRAP.packets.find((packet) => packet.type === 'set_item' && 'tile' in packet.location && packet.item === plateIndex)
    if (
      slicedBunIndex < 0 || slicedCheeseIndex < 0 || panIndex < 0 || panSearedPattyIndex < 0
      || plateBunIndex < 0 || platePattyBunIndex < 0 || finalBurgerIndex < 0
      || !plateTilePacket || !('tile' in plateTilePacket.location)
    ) {
      throw new Error('Missing burger assembly fixture')
    }

    const bunAdded = applyGameplayPacketToAuthority(createLocalAuthoritySession({
      ...createInitialAuthoritySnapshot(),
      hands: [slicedBunIndex, null],
    }), createGameplayPacketMessage('interact', {
      player: 1,
      hand: 0,
      target: { tile: plateTilePacket.location.tile },
    }))

    expect(bunAdded.session.snapshot.hands[0]).toBeNull()
    expect(bunAdded.session.snapshot.tileItems[plateTilePacket.location.tile.join(',')]).toBe(plateBunIndex)

    const pattyAdded = applyGameplayPacketToAuthority(createLocalAuthoritySession({
      ...bunAdded.session.snapshot,
      hands: [panSearedPattyIndex, null],
    }), createGameplayPacketMessage('interact', {
      player: 1,
      hand: 0,
      target: { tile: plateTilePacket.location.tile },
    }))

    expect(pattyAdded.session.snapshot.hands[0]).toBe(panIndex)
    expect(pattyAdded.session.snapshot.tileItems[plateTilePacket.location.tile.join(',')]).toBe(platePattyBunIndex)
    expect(pattyAdded.packets).toEqual([
      {
        type: 'set_item',
        location: { tile: plateTilePacket.location.tile },
        item: null,
      },
      {
        type: 'move_item',
        from: { player: [1, 0] },
        to: { tile: plateTilePacket.location.tile },
      },
      {
        type: 'set_item',
        location: { tile: plateTilePacket.location.tile },
        item: null,
      },
      {
        type: 'set_item',
        location: { tile: plateTilePacket.location.tile },
        item: panIndex,
      },
      {
        type: 'move_item',
        from: { tile: plateTilePacket.location.tile },
        to: { player: [1, 0] },
      },
      {
        type: 'set_item',
        location: { tile: plateTilePacket.location.tile },
        item: platePattyBunIndex,
      },
    ])

    const finished = applyGameplayPacketToAuthority(createLocalAuthoritySession({
      ...pattyAdded.session.snapshot,
      hands: [slicedCheeseIndex, null],
    }), createGameplayPacketMessage('interact', {
      player: 1,
      hand: 0,
      target: { tile: plateTilePacket.location.tile },
    }))

    expect(finished.session.snapshot.hands[0]).toBeNull()
    expect(finished.session.snapshot.tileItems[plateTilePacket.location.tile.join(',')]).toBe(finalBurgerIndex)
  })

  it('builds the same cheeseburger output in a different valid order', () => {
    const slicedBunIndex = BURGERS_INC_BOOTSTRAP.item_names.indexOf('sliced-bun')
    const slicedCheeseIndex = BURGERS_INC_BOOTSTRAP.item_names.indexOf('sliced-cheese')
    const panIndex = BURGERS_INC_BOOTSTRAP.item_names.indexOf('pan')
    const panSearedPattyIndex = BURGERS_INC_BOOTSTRAP.item_names.indexOf('pan:seared-patty')
    const plateIndex = BURGERS_INC_BOOTSTRAP.item_names.indexOf('plate')
    const plateCheeseIndex = BURGERS_INC_BOOTSTRAP.item_names.indexOf('plate:sliced-cheese')
    const platePattyCheeseIndex = BURGERS_INC_BOOTSTRAP.item_names.indexOf('plate:seared-patty,sliced-cheese')
    const finalBurgerIndex = BURGERS_INC_BOOTSTRAP.item_names.indexOf('plate:seared-patty,sliced-bun,sliced-cheese')
    const plateTilePacket = BURGERS_INC_BOOTSTRAP.packets.find((packet) => packet.type === 'set_item' && 'tile' in packet.location && packet.item === plateIndex)
    if (
      slicedBunIndex < 0 || slicedCheeseIndex < 0 || panIndex < 0 || panSearedPattyIndex < 0
      || plateCheeseIndex < 0 || platePattyCheeseIndex < 0 || finalBurgerIndex < 0
      || !plateTilePacket || !('tile' in plateTilePacket.location)
    ) {
      throw new Error('Missing alternate burger assembly fixture')
    }

    const cheeseAdded = applyGameplayPacketToAuthority(createLocalAuthoritySession({
      ...createInitialAuthoritySnapshot(),
      hands: [slicedCheeseIndex, null],
    }), createGameplayPacketMessage('interact', {
      player: 1,
      hand: 0,
      target: { tile: plateTilePacket.location.tile },
    }))

    expect(cheeseAdded.session.snapshot.tileItems[plateTilePacket.location.tile.join(',')]).toBe(plateCheeseIndex)

    const pattyAdded = applyGameplayPacketToAuthority(createLocalAuthoritySession({
      ...cheeseAdded.session.snapshot,
      hands: [panSearedPattyIndex, null],
    }), createGameplayPacketMessage('interact', {
      player: 1,
      hand: 0,
      target: { tile: plateTilePacket.location.tile },
    }))

    expect(pattyAdded.session.snapshot.hands[0]).toBe(panIndex)
    expect(pattyAdded.session.snapshot.tileItems[plateTilePacket.location.tile.join(',')]).toBe(platePattyCheeseIndex)

    const finished = applyGameplayPacketToAuthority(createLocalAuthoritySession({
      ...pattyAdded.session.snapshot,
      hands: [slicedBunIndex, null],
    }), createGameplayPacketMessage('interact', {
      player: 1,
      hand: 0,
      target: { tile: plateTilePacket.location.tile },
    }))

    expect(finished.session.snapshot.tileItems[plateTilePacket.location.tile.join(',')]).toBe(finalBurgerIndex)
  })

  it('assembles salad and tomato-lettuce burger variants through plate instant recipes', () => {
    const slicedTomatoIndex = BURGERS_INC_BOOTSTRAP.item_names.indexOf('sliced-tomato')
    const slicedLettuceIndex = BURGERS_INC_BOOTSTRAP.item_names.indexOf('sliced-lettuce')
    const slicedBunIndex = BURGERS_INC_BOOTSTRAP.item_names.indexOf('sliced-bun')
    const panSearedPattyIndex = BURGERS_INC_BOOTSTRAP.item_names.indexOf('pan:seared-patty')
    const plateIndex = BURGERS_INC_BOOTSTRAP.item_names.indexOf('plate')
    const saladIndex = BURGERS_INC_BOOTSTRAP.item_names.indexOf('plate:sliced-lettuce,sliced-tomato')
    const burgerIndex = BURGERS_INC_BOOTSTRAP.item_names.indexOf('plate:seared-patty,sliced-bun,sliced-lettuce,sliced-tomato')
    const plateTilePacket = BURGERS_INC_BOOTSTRAP.packets.find((packet) => packet.type === 'set_item' && 'tile' in packet.location && packet.item === plateIndex)
    if (
      slicedTomatoIndex < 0 || slicedLettuceIndex < 0 || slicedBunIndex < 0 || panSearedPattyIndex < 0
      || plateIndex < 0 || saladIndex < 0 || burgerIndex < 0
      || !plateTilePacket || !('tile' in plateTilePacket.location)
    ) {
      throw new Error('Missing salad or tomato-lettuce burger fixture')
    }

    const plateTile = plateTilePacket.location.tile
    const initial = createInitialAuthoritySnapshot()

    const withTomato = applyGameplayPacketToAuthority(createLocalAuthoritySession({
      ...initial,
      hands: [slicedTomatoIndex, null],
    }), createGameplayPacketMessage('interact', {
      player: 1,
      hand: 0,
      target: { tile: plateTile },
    }))
    const salad = applyGameplayPacketToAuthority(createLocalAuthoritySession({
      ...withTomato.session.snapshot,
      hands: [slicedLettuceIndex, null],
    }), createGameplayPacketMessage('interact', {
      player: 1,
      hand: 0,
      target: { tile: plateTile },
    }))

    expect(salad.session.snapshot.tileItems[plateTile.join(',')]).toBe(saladIndex)

    const burgerWithBun = applyGameplayPacketToAuthority(createLocalAuthoritySession({
      ...initial,
      hands: [slicedBunIndex, null],
    }), createGameplayPacketMessage('interact', {
      player: 1,
      hand: 0,
      target: { tile: plateTile },
    }))
    const burgerWithPatty = applyGameplayPacketToAuthority(createLocalAuthoritySession({
      ...burgerWithBun.session.snapshot,
      hands: [panSearedPattyIndex, null],
    }), createGameplayPacketMessage('interact', {
      player: 1,
      hand: 0,
      target: { tile: plateTile },
    }))
    const burgerWithTomato = applyGameplayPacketToAuthority(createLocalAuthoritySession({
      ...burgerWithPatty.session.snapshot,
      hands: [slicedTomatoIndex, null],
    }), createGameplayPacketMessage('interact', {
      player: 1,
      hand: 0,
      target: { tile: plateTile },
    }))
    const burger = applyGameplayPacketToAuthority(createLocalAuthoritySession({
      ...burgerWithTomato.session.snapshot,
      hands: [slicedLettuceIndex, null],
    }), createGameplayPacketMessage('interact', {
      player: 1,
      hand: 0,
      target: { tile: plateTile },
    }))

    expect(burger.session.snapshot.tileItems[plateTile.join(',')]).toBe(burgerIndex)
  })

  it('starts and completes passive stove searing and burn progression', () => {
    const pattyIndex = BURGERS_INC_BOOTSTRAP.item_names.indexOf('patty')
    const panIndex = BURGERS_INC_BOOTSTRAP.item_names.indexOf('pan')
    const panPattyIndex = BURGERS_INC_BOOTSTRAP.item_names.indexOf('pan:patty')
    const panSearedPattyIndex = BURGERS_INC_BOOTSTRAP.item_names.indexOf('pan:seared-patty')
    const panBurnedIndex = BURGERS_INC_BOOTSTRAP.item_names.indexOf('pan:burned')
    const panTilePacket = BURGERS_INC_BOOTSTRAP.packets.find((packet) => packet.type === 'set_item' && 'tile' in packet.location && packet.item === panIndex)
    if (pattyIndex < 0 || panPattyIndex < 0 || panSearedPattyIndex < 0 || panBurnedIndex < 0 || !panTilePacket || !('tile' in panTilePacket.location)) {
      throw new Error('Missing passive stove fixture')
    }

    const combined = applyGameplayPacketToAuthority(createLocalAuthoritySession({
      ...createInitialAuthoritySnapshot(),
      hands: [pattyIndex, null],
    }), createGameplayPacketMessage('interact', {
      player: 1,
      hand: 0,
      target: { tile: panTilePacket.location.tile },
    }))

    const startedSear = applyGameplayPacketToAuthority(combined.session, createGameplayPacketMessage('interact', {
      player: 1,
      hand: 0,
      target: { tile: panTilePacket.location.tile },
    }))

    expect(startedSear.session.snapshot.progressTiles[panTilePacket.location.tile.join(',')]).toMatchObject({
      position: 0,
      speed: 1 / 15,
      baseSpeed: 1 / 15,
      warn: false,
      players: [],
      handOutput: null,
      tileOutput: panSearedPattyIndex,
    })
    expect(startedSear.packets).toEqual([
      {
        type: 'set_progress',
        players: [],
        item: { tile: panTilePacket.location.tile },
        position: 0,
        speed: 1 / 15,
        warn: false,
      },
    ])

    const seared = advanceAuthoritySession(startedSear.session, 15)
    expect(seared.session.snapshot.progressTiles[panTilePacket.location.tile.join(',')]).toBeUndefined()
    expect(seared.session.snapshot.tileItems[panTilePacket.location.tile.join(',')]).toBe(panSearedPattyIndex)
    expect(seared.packets).toEqual([
      {
        type: 'set_progress',
        players: [],
        item: { tile: panTilePacket.location.tile },
        position: 1,
        speed: 0,
        warn: false,
      },
      {
        type: 'set_item',
        location: { tile: panTilePacket.location.tile },
        item: panSearedPattyIndex,
      },
    ])

    const startedBurn = applyGameplayPacketToAuthority(seared.session, createGameplayPacketMessage('interact', {
      player: 1,
      hand: 0,
      target: { tile: panTilePacket.location.tile },
    }))

    expect(startedBurn.session.snapshot.progressTiles[panTilePacket.location.tile.join(',')]).toMatchObject({
      position: 0,
      speed: 1 / 5,
      baseSpeed: 1 / 5,
      warn: true,
      players: [],
      handOutput: null,
      tileOutput: panBurnedIndex,
    })
    expect(startedBurn.packets).toEqual([
      {
        type: 'set_progress',
        players: [],
        item: { tile: panTilePacket.location.tile },
        position: 0,
        speed: 1 / 5,
        warn: true,
      },
    ])

    const burned = advanceAuthoritySession(startedBurn.session, 5)
    expect(burned.session.snapshot.progressTiles[panTilePacket.location.tile.join(',')]).toBeUndefined()
    expect(burned.session.snapshot.tileItems[panTilePacket.location.tile.join(',')]).toBe(panBurnedIndex)
    expect(burned.packets).toEqual([
      {
        type: 'set_progress',
        players: [],
        item: { tile: panTilePacket.location.tile },
        position: 1,
        speed: 0,
        warn: true,
      },
      {
        type: 'set_item',
        location: { tile: panTilePacket.location.tile },
        item: panBurnedIndex,
      },
    ])
  })

  it('auto-starts steak searing on the stove and plates the result', () => {
    const steakIndex = BURGERS_INC_BOOTSTRAP.item_names.indexOf('steak')
    const panIndex = BURGERS_INC_BOOTSTRAP.item_names.indexOf('pan')
    const panSteakIndex = BURGERS_INC_BOOTSTRAP.item_names.indexOf('pan:steak')
    const panSearedSteakIndex = BURGERS_INC_BOOTSTRAP.item_names.indexOf('pan:seared-steak')
    const plateIndex = BURGERS_INC_BOOTSTRAP.item_names.indexOf('plate')
    const plateSearedSteakIndex = BURGERS_INC_BOOTSTRAP.item_names.indexOf('plate:seared-steak')
    const panTilePacket = BURGERS_INC_BOOTSTRAP.packets.find((packet) => packet.type === 'set_item' && 'tile' in packet.location && packet.item === panIndex)
    const plateTilePacket = BURGERS_INC_BOOTSTRAP.packets.find((packet) => packet.type === 'set_item' && 'tile' in packet.location && packet.item === plateIndex)
    if (
      steakIndex < 0 || panSteakIndex < 0 || panSearedSteakIndex < 0 || plateSearedSteakIndex < 0
      || !panTilePacket || !('tile' in panTilePacket.location)
      || !plateTilePacket || !('tile' in plateTilePacket.location)
    ) throw new Error('Missing steak sear fixture')

    const combined = applyGameplayPacketToAuthority(createLocalAuthoritySession({
      ...createInitialAuthoritySnapshot(),
      hands: [steakIndex, null],
    }), createGameplayPacketMessage('interact', {
      player: 1,
      hand: 0,
      target: { tile: panTilePacket.location.tile },
    }))

    expect(combined.session.snapshot.tileItems[panTilePacket.location.tile.join(',')]).toBe(panSteakIndex)

    const autoStarted = advanceAuthoritySession(combined.session, 0.1)
    expect(autoStarted.session.snapshot.progressTiles[panTilePacket.location.tile.join(',')]).toMatchObject({
      speed: 1 / 15,
      warn: false,
      tileOutput: panSearedSteakIndex,
    })
    expect(autoStarted.packets).toContainEqual({
      type: 'set_progress',
      players: [],
      item: { tile: panTilePacket.location.tile },
      position: 0,
      speed: 1 / 15,
      warn: false,
    })

    const seared = advanceAuthoritySession(autoStarted.session, 15)
    expect(seared.session.snapshot.tileItems[panTilePacket.location.tile.join(',')]).toBe(panSearedSteakIndex)

    const plated = applyGameplayPacketToAuthority(createLocalAuthoritySession({
      ...seared.session.snapshot,
      hands: [panSearedSteakIndex, null],
    }), createGameplayPacketMessage('interact', {
      player: 1,
      hand: 0,
      target: { tile: plateTilePacket.location.tile },
    }))

    expect(plated.session.snapshot.hands[0]).toBe(panIndex)
    expect(plated.session.snapshot.tileItems[plateTilePacket.location.tile.join(',')]).toBe(plateSearedSteakIndex)
  })

  it('auto-starts fries in the fryer, burns them, and recovers the basket via trash', () => {
    const slicedPotatoIndex = BURGERS_INC_BOOTSTRAP.item_names.indexOf('sliced-potato')
    const basketIndex = BURGERS_INC_BOOTSTRAP.item_names.indexOf('basket')
    const basketSlicedPotatoIndex = BURGERS_INC_BOOTSTRAP.item_names.indexOf('basket:sliced-potato')
    const basketFriesIndex = BURGERS_INC_BOOTSTRAP.item_names.indexOf('basket:french-fries')
    const basketBurnedIndex = BURGERS_INC_BOOTSTRAP.item_names.indexOf('basket:burned')
    const fryerTilePacket = BURGERS_INC_BOOTSTRAP.packets.find((packet) => packet.type === 'set_item' && 'tile' in packet.location && packet.item === basketIndex)
    const trashTile = BURGERS_INC_BOOTSTRAP.changes.find(([_, tileIndexes]) => tileIndexes.some((tileIndex) => BURGERS_INC_BOOTSTRAP.tile_names[tileIndex] === 'trash'))
    if (
      slicedPotatoIndex < 0 || basketSlicedPotatoIndex < 0 || basketFriesIndex < 0 || basketBurnedIndex < 0
      || !fryerTilePacket || !('tile' in fryerTilePacket.location) || !trashTile
    ) throw new Error('Missing fries fixture')

    const combined = applyGameplayPacketToAuthority(createLocalAuthoritySession({
      ...createInitialAuthoritySnapshot(),
      hands: [slicedPotatoIndex, null],
    }), createGameplayPacketMessage('interact', {
      player: 1,
      hand: 0,
      target: { tile: fryerTilePacket.location.tile },
    }))

    expect(combined.session.snapshot.tileItems[fryerTilePacket.location.tile.join(',')]).toBe(basketSlicedPotatoIndex)

    const started = advanceAuthoritySession(combined.session, 0.1)
    expect(started.session.snapshot.progressTiles[fryerTilePacket.location.tile.join(',')]).toMatchObject({
      speed: 1 / 15,
      warn: false,
      tileOutput: basketFriesIndex,
    })

    const fries = advanceAuthoritySession(started.session, 15)
    expect(fries.session.snapshot.tileItems[fryerTilePacket.location.tile.join(',')]).toBe(basketFriesIndex)

    const burnedStarted = advanceAuthoritySession(fries.session, 0.1)
    expect(burnedStarted.session.snapshot.progressTiles[fryerTilePacket.location.tile.join(',')]).toMatchObject({
      speed: 1 / 7.5,
      warn: true,
      tileOutput: basketBurnedIndex,
    })

    const burned = advanceAuthoritySession(burnedStarted.session, 7.5)
    expect(burned.session.snapshot.tileItems[fryerTilePacket.location.tile.join(',')]).toBe(basketBurnedIndex)

    const recovered = applyGameplayPacketToAuthority(createLocalAuthoritySession({
      ...burned.session.snapshot,
      hands: [basketBurnedIndex, null],
    }), createGameplayPacketMessage('interact', {
      player: 1,
      hand: 0,
      target: { tile: trashTile[0] },
    }))

    expect(recovered.session.snapshot.hands[0]).toBe(basketIndex)
  })

  it('plates fries and steak into a combined demand item', () => {
    const basketFriesIndex = BURGERS_INC_BOOTSTRAP.item_names.indexOf('basket:french-fries')
    const panSearedSteakIndex = BURGERS_INC_BOOTSTRAP.item_names.indexOf('pan:seared-steak')
    const basketIndex = BURGERS_INC_BOOTSTRAP.item_names.indexOf('basket')
    const panIndex = BURGERS_INC_BOOTSTRAP.item_names.indexOf('pan')
    const plateIndex = BURGERS_INC_BOOTSTRAP.item_names.indexOf('plate')
    const plateFriesIndex = BURGERS_INC_BOOTSTRAP.item_names.indexOf('plate:french-fries')
    const combinedPlateIndex = BURGERS_INC_BOOTSTRAP.item_names.indexOf('plate:french-fries,seared-steak')
    const plateTilePacket = BURGERS_INC_BOOTSTRAP.packets.find((packet) => packet.type === 'set_item' && 'tile' in packet.location && packet.item === plateIndex)
    if (
      basketFriesIndex < 0 || panSearedSteakIndex < 0 || basketIndex < 0 || panIndex < 0 || plateFriesIndex < 0 || combinedPlateIndex < 0
      || !plateTilePacket || !('tile' in plateTilePacket.location)
    ) throw new Error('Missing steak fries plate fixture')

    const withFries = applyGameplayPacketToAuthority(createLocalAuthoritySession({
      ...createInitialAuthoritySnapshot(),
      hands: [basketFriesIndex, null],
    }), createGameplayPacketMessage('interact', {
      player: 1,
      hand: 0,
      target: { tile: plateTilePacket.location.tile },
    }))

    expect(withFries.session.snapshot.hands[0]).toBe(basketIndex)
    expect(withFries.session.snapshot.tileItems[plateTilePacket.location.tile.join(',')]).toBe(plateFriesIndex)

    const combined = applyGameplayPacketToAuthority(createLocalAuthoritySession({
      ...withFries.session.snapshot,
      hands: [panSearedSteakIndex, null],
    }), createGameplayPacketMessage('interact', {
      player: 1,
      hand: 0,
      target: { tile: plateTilePacket.location.tile },
    }))

    expect(combined.session.snapshot.hands[0]).toBe(panIndex)
    expect(combined.session.snapshot.tileItems[plateTilePacket.location.tile.join(',')]).toBe(combinedPlateIndex)
  })

  it('recovers a burned pan through the trash instant authority path', () => {
    const burnedPanIndex = BURGERS_INC_BOOTSTRAP.item_names.indexOf('pan:burned')
    const panIndex = BURGERS_INC_BOOTSTRAP.item_names.indexOf('pan')
    const trashTile = BURGERS_INC_BOOTSTRAP.changes.find(([_, tileIndexes]) => tileIndexes.some((tileIndex) => BURGERS_INC_BOOTSTRAP.tile_names[tileIndex] === 'trash'))
    if (burnedPanIndex < 0 || panIndex < 0 || !trashTile) throw new Error('Missing trash recovery fixture')

    const recovered = applyGameplayPacketToAuthority(createLocalAuthoritySession({
      ...createInitialAuthoritySnapshot(),
      hands: [burnedPanIndex, null],
    }), createGameplayPacketMessage('interact', {
      player: 1,
      hand: 0,
      target: { tile: trashTile[0] },
    }))

    expect(recovered.session.snapshot.hands[0]).toBe(panIndex)
    expect(recovered.packets).toEqual([
      {
        type: 'move_item',
        from: { player: [1, 0] },
        to: { tile: trashTile[0] },
      },
      {
        type: 'set_item',
        location: { tile: trashTile[0] },
        item: null,
      },
      {
        type: 'set_item',
        location: { tile: trashTile[0] },
        item: panIndex,
      },
      {
        type: 'move_item',
        from: { tile: trashTile[0] },
        to: { player: [1, 0] },
      },
    ])
  })

  it('trashes a partial plated burger into a dirty plate', () => {
    const partialPlateIndex = BURGERS_INC_BOOTSTRAP.item_names.indexOf('plate:sliced-bun')
    const dirtyPlateIndex = BURGERS_INC_BOOTSTRAP.item_names.indexOf('dirty-plate')
    const trashTile = BURGERS_INC_BOOTSTRAP.changes.find(([_, tileIndexes]) => tileIndexes.some((tileIndex) => BURGERS_INC_BOOTSTRAP.tile_names[tileIndex] === 'trash'))
    if (partialPlateIndex < 0 || dirtyPlateIndex < 0 || !trashTile) throw new Error('Missing plated trash fixture')

    const trashed = applyGameplayPacketToAuthority(createLocalAuthoritySession({
      ...createInitialAuthoritySnapshot(),
      hands: [partialPlateIndex, null],
    }), createGameplayPacketMessage('interact', {
      player: 1,
      hand: 0,
      target: { tile: trashTile[0] },
    }))

    expect(trashed.session.snapshot.hands[0]).toBe(dirtyPlateIndex)
    expect(trashed.packets).toEqual([
      {
        type: 'move_item',
        from: { player: [1, 0] },
        to: { tile: trashTile[0] },
      },
      {
        type: 'set_item',
        location: { tile: trashTile[0] },
        item: null,
      },
      {
        type: 'set_item',
        location: { tile: trashTile[0] },
        item: dirtyPlateIndex,
      },
      {
        type: 'move_item',
        from: { tile: trashTile[0] },
        to: { player: [1, 0] },
      },
    ])
  })

  it('trashes loose disposable items completely', () => {
    const slicedCheeseIndex = BURGERS_INC_BOOTSTRAP.item_names.indexOf('sliced-cheese')
    const trashTile = BURGERS_INC_BOOTSTRAP.changes.find(([_, tileIndexes]) => tileIndexes.some((tileIndex) => BURGERS_INC_BOOTSTRAP.tile_names[tileIndex] === 'trash'))
    if (slicedCheeseIndex < 0 || !trashTile) throw new Error('Missing loose-item trash fixture')

    const trashed = applyGameplayPacketToAuthority(createLocalAuthoritySession({
      ...createInitialAuthoritySnapshot(),
      hands: [slicedCheeseIndex, null],
    }), createGameplayPacketMessage('interact', {
      player: 1,
      hand: 0,
      target: { tile: trashTile[0] },
    }))

    expect(trashed.session.snapshot.hands[0]).toBeNull()
    expect(trashed.packets).toEqual([
      {
        type: 'move_item',
        from: { player: [1, 0] },
        to: { tile: trashTile[0] },
      },
      {
        type: 'set_item',
        location: { tile: trashTile[0] },
        item: null,
      },
    ])
  })

  it('serves one cheeseburger to the initial customer and returns a dirty plate', () => {
    const burgerIndex = BURGERS_INC_BOOTSTRAP.item_names.indexOf('plate:seared-patty,sliced-bun,sliced-cheese')
    const dirtyPlateIndex = BURGERS_INC_BOOTSTRAP.item_names.indexOf('dirty-plate')
    if (burgerIndex < 0 || dirtyPlateIndex < 0) throw new Error('Missing customer serving fixture')

    const initial = createInitialAuthoritySnapshot()
    if (!initial.customer) throw new Error('Missing initial customer fixture')

    const tableKey = initial.customer.table.join(',')
    const servedSession = createLocalAuthoritySession({
      ...initial,
      tileItems: {
        ...initial.tileItems,
        [tableKey]: burgerIndex,
      },
    })

    const served = advanceAuthoritySession(servedSession, 0.1)
    expect(served.session.snapshot.score.points).toBe(9)
    expect(served.session.snapshot.score.demands_completed).toBe(1)
    expect(served.session.snapshot.tileItems[tableKey]).toBeNull()
    expect(served.session.snapshot.customer).toMatchObject({
      phase: 'eating',
      handItem: burgerIndex,
      scorePending: false,
    })
    expect(served.packets).toEqual([
      {
        type: 'communicate',
        player: initial.customer.id,
        message: null,
        timeout: null,
      },
      {
        type: 'effect',
        effect: 'satisfied',
        location: { player: [initial.customer.id, 0] },
      },
      {
        type: 'effect',
        effect: 'points',
        amount: 9,
        location: { player: [initial.customer.id, 0] },
      },
      {
        type: 'move_item',
        from: { tile: initial.customer.table },
        to: { player: [initial.customer.id, 0] },
      },
      {
        type: 'score',
        ...served.session.snapshot.score,
      },
    ])

    const scored = advanceAuthoritySession(served.session, 0.1)
    expect(scored.packets).toEqual([])

    const eaten = advanceAuthoritySession(scored.session, 10)
    expect(eaten.session.snapshot.customer).toMatchObject({
      phase: 'finishing',
      handItem: dirtyPlateIndex,
    })
    expect(eaten.packets).toEqual([
      {
        type: 'set_item',
        location: { player: [initial.customer.id, 0] },
        item: dirtyPlateIndex,
      },
    ])

    const returned = advanceAuthoritySession(eaten.session, 0.1)
    expect(returned.session.snapshot.tileItems[tableKey]).toBe(dirtyPlateIndex)
    expect(returned.session.snapshot.customer).toMatchObject({
      phase: 'exiting',
      handItem: null,
      despawnPending: true,
    })
    expect(returned.packets).toEqual([
      {
        type: 'move_item',
        from: { player: [initial.customer.id, 0] },
        to: { tile: initial.customer.table },
      },
    ])

    const removed = advanceAuthoritySession(returned.session, 0.1)
    expect(removed.session.snapshot.customer?.phase).toBe('gone')
    expect(removed.packets).toEqual([
      {
        type: 'remove_player',
        id: initial.customer.id,
      },
    ])
  })

  it('does not serve a wrong item to the initial customer', () => {
    const wrongItemIndex = BURGERS_INC_BOOTSTRAP.item_names.indexOf('plate:sliced-bun')
    if (wrongItemIndex < 0) throw new Error('Missing wrong item fixture')

    const initial = createInitialAuthoritySnapshot()
    if (!initial.customer) throw new Error('Missing initial customer fixture')

    const tableKey = initial.customer.table.join(',')
    const session = createLocalAuthoritySession({
      ...initial,
      tileItems: {
        ...initial.tileItems,
        [tableKey]: wrongItemIndex,
      },
    })

    const result = advanceAuthoritySession(session, 0.1)
    expect(result.session.snapshot.tileItems[tableKey]).toBe(wrongItemIndex)
    expect(result.session.snapshot.score).toEqual(initial.score)
    expect(result.session.snapshot.customer).toMatchObject({ phase: 'waiting' })
    expect(result.packets).toEqual([])
  })

  it('serves a salad demand when the customer demand item is changed from bootstrap metadata', () => {
    const saladIndex = BURGERS_INC_BOOTSTRAP.item_names.indexOf('plate:sliced-lettuce,sliced-tomato')
    if (saladIndex < 0) throw new Error('Missing salad demand fixture')

    const initial = createInitialAuthoritySnapshot()
    if (!initial.customer) throw new Error('Missing initial customer fixture')

    const tableKey = initial.customer.table.join(',')
    const session = createLocalAuthoritySession({
      ...initial,
      customer: {
        ...initial.customer,
        demandItem: saladIndex,
        orderMessage: { item: saladIndex },
      },
      tileItems: {
        ...initial.tileItems,
        [tableKey]: saladIndex,
      },
    })

    const served = advanceAuthoritySession(session, 0.1)
    expect(served.session.snapshot.customer).toMatchObject({
      phase: 'eating',
      handItem: saladIndex,
    })
    expect(served.session.snapshot.score).toMatchObject({
      points: 9,
      demands_completed: 1,
    })
  })

  it('times out an unserved customer, removes them, and respawns a fresh order', () => {
    const initial = createInitialAuthoritySnapshot()
    if (!initial.customer) throw new Error('Missing timeout customer fixture')
    const nextDemandName = BURGERS_INC_BOOTSTRAP.metadata.demand_items[1]
    const nextDemandIndex = BURGERS_INC_BOOTSTRAP.item_names.indexOf(nextDemandName)
    if (!nextDemandName || nextDemandIndex < 0) throw new Error('Missing respawn demand fixture')

    const timedOut = advanceAuthoritySession(createLocalAuthoritySession(initial), 90)
    expect(timedOut.session.snapshot.score).toMatchObject({
      points: -1,
      demands_failed: 1,
    })
    expect(timedOut.session.snapshot.customer).toMatchObject({
      phase: 'exiting',
      orderMessage: null,
      orderTimeout: null,
      despawnPending: true,
    })
    expect(timedOut.packets).toEqual([
      {
        type: 'communicate',
        player: initial.customer.id,
        message: null,
        timeout: null,
      },
      {
        type: 'effect',
        effect: 'angry',
        location: { player: [initial.customer.id, 0] },
      },
      {
        type: 'effect',
        effect: 'points',
        amount: -1,
        location: { player: [initial.customer.id, 0] },
      },
      {
        type: 'score',
        ...timedOut.session.snapshot.score,
      },
    ])

    const removed = advanceAuthoritySession(timedOut.session, 0.1)
    expect(removed.session.snapshot.customer).toMatchObject({
      phase: 'gone',
      timerRemaining: 5,
    })
    expect(removed.packets).toEqual([
      {
        type: 'remove_player',
        id: initial.customer.id,
      },
    ])

    const respawned = advanceAuthoritySession(removed.session, 5)
    expect(respawned.session.snapshot.customer).toMatchObject({
      phase: 'waiting',
      id: initial.customer.id,
      orderMessage: { item: nextDemandIndex },
    })
    expect(respawned.packets).toContainEqual({
      type: 'add_player',
      id: initial.customer.id,
      name: '',
      position: initial.customer.position,
      character: initial.customer.character,
      class: 'customer',
    })
    expect(respawned.packets).toContainEqual({
      type: 'communicate',
      player: initial.customer.id,
      message: { item: nextDemandIndex },
      timeout: { initial: 90, remaining: 90, pinned: true },
    })
  })

  it('respawns a fresh customer after a completed serve loop', () => {
    const burgerIndex = BURGERS_INC_BOOTSTRAP.item_names.indexOf('plate:seared-patty,sliced-bun,sliced-cheese')
    const nextDemandName = BURGERS_INC_BOOTSTRAP.metadata.demand_items[1]
    const nextDemandIndex = BURGERS_INC_BOOTSTRAP.item_names.indexOf(nextDemandName)
    if (burgerIndex < 0 || !nextDemandName || nextDemandIndex < 0) throw new Error('Missing customer respawn fixture')

    const initial = createInitialAuthoritySnapshot()
    if (!initial.customer) throw new Error('Missing initial customer fixture')

    const tableKey = initial.customer.table.join(',')
    const servedSession = createLocalAuthoritySession({
      ...initial,
      tileItems: {
        ...initial.tileItems,
        [tableKey]: burgerIndex,
      },
    })

    const served = advanceAuthoritySession(servedSession, 0.1)
    const eaten = advanceAuthoritySession(served.session, 10)
    const returned = advanceAuthoritySession(eaten.session, 0.1)
    const removed = advanceAuthoritySession(returned.session, 0.1)
    const respawned = advanceAuthoritySession(removed.session, 5)

    expect(respawned.session.snapshot.customer).toMatchObject({
      phase: 'waiting',
      handItem: null,
      orderMessage: { item: nextDemandIndex },
    })
    expect(respawned.packets).toContainEqual(expect.objectContaining({ type: 'add_player', class: 'customer' }))
  })

  it('replays active progress packets as part of the authority state', () => {
    const snapshot = createInitialAuthoritySnapshot()
    snapshot.progressTiles['4,4'] = {
      position: 0.25,
      speed: 0.5,
      baseSpeed: 0.5,
      warn: false,
      players: [snapshot.playerId],
      hand: 0,
      handOutput: BURGERS_INC_BOOTSTRAP.item_names.indexOf('sliced-tomato'),
      tileOutput: null,
    }

    const packets = createAuthorityStatePackets(snapshot)
    expect(packets).toContainEqual({
      type: 'set_progress',
      players: [snapshot.playerId],
      item: { tile: [4, 4] },
      position: 0.25,
      speed: 0.5,
      warn: false,
    })
  })

  it('replays waiting and eating customer state through authority packets', () => {
    const waiting = createInitialAuthoritySnapshot()
    if (!waiting.customer) throw new Error('Missing waiting customer fixture')

    expect(createAuthorityStatePackets(waiting)).toContainEqual({
      type: 'communicate',
      player: waiting.customer.id,
      message: waiting.customer.orderMessage,
      timeout: waiting.customer.orderTimeout,
    })

    const burgerIndex = BURGERS_INC_BOOTSTRAP.item_names.indexOf('plate:seared-patty,sliced-bun,sliced-cheese')
    if (burgerIndex < 0) throw new Error('Missing customer replay fixture')

    const eating = createInitialAuthoritySnapshot()
    if (!eating.customer) throw new Error('Missing eating customer fixture')
    eating.customer = {
      ...eating.customer,
      phase: 'eating',
      handItem: burgerIndex,
      orderMessage: null,
      orderTimeout: null,
      timerRemaining: 5,
    }

    const packets = createAuthorityStatePackets(eating)
    expect(packets).toContainEqual({
      type: 'communicate',
      player: eating.customer.id,
      message: null,
      timeout: null,
    })
    expect(packets).toContainEqual({
      type: 'set_item',
      location: { player: [eating.customer.id, 0] },
      item: burgerIndex,
    })
  })

  it('creates authority movement packets from the initial authority snapshot', () => {
    expect(createAuthorityMovementPacket(createInitialAuthoritySnapshot())).toEqual({
      type: 'movement',
      player: BURGERS_INC_BOOTSTRAP.playerId,
      pos: BURGERS_INC_BOOTSTRAP.spawnPosition,
      rot: 0,
      dir: [0, 0],
      boost: false,
      sync: false,
    })
  })

  it('wraps live authority packets in a parent-to-iframe bridge message', () => {
    expect(createBridgeAuthorityPacketsMessage([
      createAuthorityMovementPacket(createInitialAuthoritySnapshot()),
    ])).toEqual({
      type: 'forkorfry:bridge-authority-packets',
      version: 1,
      packets: [createAuthorityMovementPacket(createInitialAuthoritySnapshot())],
    })
  })

  it('creates full authority state packets for movement, tiles, and hands', () => {
    const snapshot = createInitialAuthoritySnapshot()
    const packets = createAuthorityStatePackets(snapshot)

    expect(packets[0]).toEqual(createAuthorityMovementPacket(snapshot))
    expect(packets).toContainEqual({ type: 'score', ...snapshot.score })
    expect(packets).toContainEqual(expect.objectContaining({ type: 'add_player', class: 'customer' }))
    expect(packets.filter((packet) => packet.type === 'set_item').length).toBeGreaterThan(snapshot.hands.length)
    expect(packets).toContainEqual({
      type: 'set_item',
      location: { player: [snapshot.playerId, 0] },
      item: null,
    })
  })

  it('keeps the generated bootstrap template session-agnostic', () => {
    expect(createBurgersIncBootstrapTemplate(1)).toEqual({
      type: 'forkorfry:local-bootstrap',
      version: 1,
      map: BURGERS_INC_BOOTSTRAP.metadata.name,
      playerId: BURGERS_INC_BOOTSTRAP.playerId,
      packets: BURGERS_INC_BOOTSTRAP.packets,
    })
  })

  it('validates saved bootstrap payloads', () => {
    expect(isUpstreamBootstrapPayload(createBurgersIncBootstrapPayload('session-123', 1))).toBe(true)
    expect(isUpstreamBootstrapPayload({ type: 'forkorfry:local-bootstrap', version: 1, packets: [] })).toBe(false)
  })

  it('wraps bootstrap payloads in a parent-to-iframe bridge message', () => {
    const payload = createBurgersIncBootstrapPayload('session-123', 1)

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

    expect(isUpstreamEmbeddedToParentMessage(createGameplayPacketMessage('interact', {
      player: 1,
      hand: 0,
      target: { tile: [3, 2] },
    }))).toBe(true)
  })
})
