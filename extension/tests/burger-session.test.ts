import { describe, expect, it } from 'vitest'

import { createBurgerSessionCheckpoint, restoreBurgerSessionCheckpoint } from '../src/features/runtime-frame/checkpoint'
import { reduceBurgerSession } from '../src/features/runtime-frame/burger-session-reducer'
import { createInitialBurgerSessionState } from '../src/features/runtime-frame/burger-session-state'

function startBurger(state: ReturnType<typeof createInitialBurgerSessionState>) {
  state = reduceBurgerSession(state, { type: 'interact' })
  state = reduceBurgerSession(state, { type: 'move', location: 'grill' })
  state = reduceBurgerSession(state, { type: 'interact' })
  state = reduceBurgerSession(state, { type: 'tick' })
  state = reduceBurgerSession(state, { type: 'tick' })
  state = reduceBurgerSession(state, { type: 'tick' })
  state = reduceBurgerSession(state, { type: 'interact' })
  state = reduceBurgerSession(state, { type: 'move', location: 'board' })
  state = reduceBurgerSession(state, { type: 'interact' })

  return state
}

function serveCheeseburgerOrder(state: ReturnType<typeof createInitialBurgerSessionState>) {
  state = startBurger(state)
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

  return state
}

function servePlainBurgerOrder(state: ReturnType<typeof createInitialBurgerSessionState>) {
  state = startBurger(state)
  state = reduceBurgerSession(state, { type: 'move', location: 'storage' })
  state = reduceBurgerSession(state, { type: 'interact' })
  state = reduceBurgerSession(state, { type: 'move', location: 'board' })
  state = reduceBurgerSession(state, { type: 'interact' })
  state = reduceBurgerSession(state, { type: 'interact' })
  state = reduceBurgerSession(state, { type: 'move', location: 'counter' })
  state = reduceBurgerSession(state, { type: 'interact' })

  return state
}

describe('burger session reducer', () => {
  it('serves a full multi-order burger shift through the local-only kitchen loop', () => {
    let state = reduceBurgerSession(createInitialBurgerSessionState(), { type: 'boot', checkpoint: null })

    state = serveCheeseburgerOrder(state)
    expect(state.phase).toBe('running')
    expect(state.score).toBe(1)
    expect(state.shift.servedCount).toBe(1)
    expect(state.currentOrder?.id).toBe('burger-order-2')
    expect(state.currentOrder?.recipeId).toBe('plain-burger')

    state = servePlainBurgerOrder(state)
    expect(state.phase).toBe('running')
    expect(state.score).toBe(2)
    expect(state.shift.servedCount).toBe(2)
    expect(state.currentOrder?.id).toBe('burger-order-3')
    expect(state.currentOrder?.recipeId).toBe('cheeseburger')

    state = serveCheeseburgerOrder(state)
    expect(state.phase).toBe('completed')
    expect(state.score).toBe(3)
    expect(state.shift.servedCount).toBe(3)
    expect(state.shift.failedCount).toBe(0)
    expect(state.currentOrder).toBeNull()
  })

  it('fails an order and continues the shift with the next queued burger', () => {
    let state = reduceBurgerSession(createInitialBurgerSessionState(), { type: 'boot', checkpoint: null })

    for (let index = 0; index < 18; index += 1) {
      state = reduceBurgerSession(state, { type: 'tick' })
    }

    expect(state.phase).toBe('running')
    expect(state.shift.failedCount).toBe(1)
    expect(state.shift.servedCount).toBe(0)
    expect(state.currentOrder?.id).toBe('burger-order-2')
    expect(state.player.location).toBe('storage')
  })

  it('rejects the wrong recipe and keeps the current order active', () => {
    let state = reduceBurgerSession(createInitialBurgerSessionState(), { type: 'boot', checkpoint: null })

    state = serveCheeseburgerOrder(state)
    state = startBurger(state)
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

    expect(state.phase).toBe('running')
    expect(state.score).toBe(1)
    expect(state.shift.servedCount).toBe(1)
    expect(state.currentOrder?.id).toBe('burger-order-2')
    expect(state.player.heldItem).toBeNull()
    expect(state.log.at(-1)).toContain('Counter rejected Cheeseburger. Need Plain burger.')
  })

  it('round-trips a burger-session checkpoint and preserves mid-shift progress', () => {
    let state = reduceBurgerSession(createInitialBurgerSessionState(), { type: 'boot', checkpoint: null })
    state = serveCheeseburgerOrder(state)
    state = reduceBurgerSession(state, { type: 'interact' })
    state = reduceBurgerSession(state, { type: 'move', location: 'grill' })
    state = reduceBurgerSession(state, { type: 'interact' })
    state = reduceBurgerSession(state, { type: 'tick' })

    const checkpoint = createBurgerSessionCheckpoint('burger-runtime', state)
    const restored = restoreBurgerSessionCheckpoint('burger-runtime', checkpoint)

    expect(restored.shift.servedCount).toBe(1)
    expect(restored.currentOrder?.id).toBe('burger-order-2')
    expect(restored.currentOrder?.recipeId).toBe('plain-burger')
    expect(restored.tick).toBe(4)
    expect(restored.player.location).toBe('grill')
    expect(restored.stations.grill.patty).toBe('cooking')
  })
})
