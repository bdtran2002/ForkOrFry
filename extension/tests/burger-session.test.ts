import { describe, expect, it } from 'vitest'

import { createBurgerSessionCheckpoint, restoreBurgerSessionCheckpoint } from '../src/features/runtime-frame/checkpoint'
import { reduceBurgerSession } from '../src/features/runtime-frame/burger-session-reducer'
import { createInitialBurgerSessionState } from '../src/features/runtime-frame/burger-session-state'

describe('burger session reducer', () => {
  it('serves a burger through the local-only kitchen loop', () => {
    let state = reduceBurgerSession(createInitialBurgerSessionState(), { type: 'boot', checkpoint: null })

    state = reduceBurgerSession(state, { type: 'interact' })
    state = reduceBurgerSession(state, { type: 'move', location: 'grill' })
    state = reduceBurgerSession(state, { type: 'interact' })
    state = reduceBurgerSession(state, { type: 'tick' })
    state = reduceBurgerSession(state, { type: 'tick' })
    state = reduceBurgerSession(state, { type: 'tick' })
    state = reduceBurgerSession(state, { type: 'interact' })
    state = reduceBurgerSession(state, { type: 'move', location: 'board' })
    state = reduceBurgerSession(state, { type: 'interact' })
    state = reduceBurgerSession(state, { type: 'move', location: 'storage' })
    state = reduceBurgerSession(state, { type: 'interact' })
    state = reduceBurgerSession(state, { type: 'move', location: 'board' })
    state = reduceBurgerSession(state, { type: 'interact' })
    state = reduceBurgerSession(state, { type: 'move', location: 'storage' })
    state = reduceBurgerSession(state, { type: 'interact' })
    state = reduceBurgerSession(state, { type: 'move', location: 'board' })
    state = reduceBurgerSession(state, { type: 'interact' })
    state = reduceBurgerSession(state, { type: 'interact' })
    state = reduceBurgerSession(state, { type: 'move', location: 'counter' })
    state = reduceBurgerSession(state, { type: 'interact' })

    expect(state.phase).toBe('completed')
    expect(state.score).toBe(1)
    expect(state.activeOrder.status).toBe('served')
  })

  it('round-trips a burger-session checkpoint and preserves progress', () => {
    let state = reduceBurgerSession(createInitialBurgerSessionState(), { type: 'boot', checkpoint: null })
    state = reduceBurgerSession(state, { type: 'interact' })
    state = reduceBurgerSession(state, { type: 'move', location: 'grill' })
    state = reduceBurgerSession(state, { type: 'interact' })
    state = reduceBurgerSession(state, { type: 'tick' })

    const checkpoint = createBurgerSessionCheckpoint('burger-runtime', state)
    const restored = restoreBurgerSessionCheckpoint('burger-runtime', checkpoint)

    expect(restored.tick).toBe(1)
    expect(restored.player.location).toBe('grill')
    expect(restored.stations.grill.patty).toBe('cooking')
  })
})
