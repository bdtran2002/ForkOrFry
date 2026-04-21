import { describe, expect, it } from 'vitest'

import { createBurgerSessionCheckpoint, restoreBurgerSessionCheckpoint } from '../src/features/runtime-frame/checkpoint'
import { BURGER_LEVEL } from '../src/features/runtime-frame/burger-level'
import { reduceBurgerSession } from '../src/features/runtime-frame/burger-session-reducer'
import { createInitialBurgerSessionState } from '../src/features/runtime-frame/burger-session-state'

function bootBurger() {
  return reduceBurgerSession(createInitialBurgerSessionState(), { type: 'boot', checkpoint: null })
}

function move(state: ReturnType<typeof bootBurger>, direction: 'up' | 'down' | 'left' | 'right') {
  return reduceBurgerSession(state, { type: 'move', direction })
}

function runCheeseburgerFlow(state: ReturnType<typeof bootBurger>) {
  state = startBurger(state)
  state = move(state, 'left')
  state = move(state, 'left')
  state = reduceBurgerSession(state, { type: 'interact' }) // bun crate
  state = move(state, 'right')
  state = move(state, 'right')
  state = reduceBurgerSession(state, { type: 'interact' }) // board bun
  state = move(state, 'down')
  state = reduceBurgerSession(state, { type: 'interact' }) // cheese crate
  state = move(state, 'up')
  state = reduceBurgerSession(state, { type: 'interact' }) // board cheese
  state = reduceBurgerSession(state, { type: 'interact' }) // assemble
  state = move(state, 'right')
  state = reduceBurgerSession(state, { type: 'interact' }) // counter serve
  return state
}

function cookPatty(state: ReturnType<typeof bootBurger>) {
  state = move(state, 'left')
  state = reduceBurgerSession(state, { type: 'interact' })
  state = move(state, 'right')
  state = move(state, 'up')
  state = reduceBurgerSession(state, { type: 'interact' })
  return state
}

function startBurger(state: ReturnType<typeof bootBurger>) {
  state = move(state, 'left')
  state = reduceBurgerSession(state, { type: 'interact' }) // patty crate
  state = move(state, 'right')
  state = move(state, 'up')
  state = reduceBurgerSession(state, { type: 'interact' }) // grill
  state = reduceBurgerSession(state, { type: 'tick' })
  state = reduceBurgerSession(state, { type: 'tick' })
  state = reduceBurgerSession(state, { type: 'tick' })
  state = reduceBurgerSession(state, { type: 'interact' }) // cooked patty
  state = move(state, 'right')
  state = reduceBurgerSession(state, { type: 'interact' }) // board cooked patty
  return state
}

function runPlainBurgerFlow(state: ReturnType<typeof bootBurger>) {
  state = move(state, 'left')
  state = reduceBurgerSession(state, { type: 'interact' })
  state = move(state, 'right')
  state = move(state, 'up')
  state = reduceBurgerSession(state, { type: 'interact' })
  state = reduceBurgerSession(state, { type: 'tick' })
  state = reduceBurgerSession(state, { type: 'tick' })
  state = reduceBurgerSession(state, { type: 'tick' })
  state = reduceBurgerSession(state, { type: 'interact' })
  state = move(state, 'right')
  state = reduceBurgerSession(state, { type: 'interact' })
  state = move(state, 'left')
  state = move(state, 'left')
  state = reduceBurgerSession(state, { type: 'interact' })
  state = move(state, 'right')
  state = move(state, 'right')
  state = reduceBurgerSession(state, { type: 'interact' })
  state = reduceBurgerSession(state, { type: 'interact' })
  state = move(state, 'right')
  state = reduceBurgerSession(state, { type: 'interact' })
  return state
}

describe('burger session reducer', () => {
  it('blocks movement into walls and requires adjacent interactables', () => {
    let state = bootBurger()

    state = reduceBurgerSession(state, { type: 'interact' })
    expect(state.log.at(-1)).toContain('Nothing is ready on the grill yet.')
    expect(state.tick).toBe(1)
    expect(state.currentOrder?.remainingTicks).toBe(BURGER_LEVEL.orders[0].durationTicks - 1)

    state = move(state, 'left')
    state = move(state, 'up')
    state = move(state, 'up')
    expect(state.player.position).toEqual({ x: 0, y: 1 })
    expect(state.player.facing).toBe('up')
    expect(state.log.at(-1)).toContain('That path is blocked.')
    expect(state.tick).toBe(4)

    state = move(state, 'left')
    state = reduceBurgerSession(state, { type: 'interact' })
    expect(state.player.heldItem).toBe('bun')
    expect(state.tick).toBe(6)
  })

  it('spends one tick on move, interact, and wait actions', () => {
    let state = bootBurger()

    state = move(state, 'left')
    expect(state.tick).toBe(1)
    expect(state.currentOrder?.remainingTicks).toBe(BURGER_LEVEL.orders[0].durationTicks - 1)

    state = reduceBurgerSession(state, { type: 'interact' })
    expect(state.tick).toBe(2)
    expect(state.currentOrder?.remainingTicks).toBe(BURGER_LEVEL.orders[0].durationTicks - 2)

    state = reduceBurgerSession(state, { type: 'tick' })
    expect(state.tick).toBe(3)
    expect(state.currentOrder?.remainingTicks).toBe(BURGER_LEVEL.orders[0].durationTicks - 3)
  })

  it('serves the full burger shift through the spatial kitchen', () => {
    let state = bootBurger()

    state = runCheeseburgerFlow(state)
    expect(state.phase).toBe('running')
    expect(state.score).toBe(1)
    expect(state.shift.servedCount).toBe(1)
    expect(state.currentOrder?.id).toBe('burger-order-2')

    state = runPlainBurgerFlow(state)
    expect(state.phase).toBe('running')
    expect(state.score).toBe(2)
    expect(state.shift.servedCount).toBe(2)
    expect(state.currentOrder?.id).toBe('burger-order-3')

    state = runCheeseburgerFlow(state)
    expect(state.phase).toBe('completed')
    expect(state.score).toBe(3)
    expect(state.shift.servedCount).toBe(3)
    expect(state.shift.failedCount).toBe(0)
    expect(state.currentOrder).toBeNull()
  })

  it('burns cooked patties if they are left on the grill', () => {
    let state = bootBurger()

    state = cookPatty(state)
    state = reduceBurgerSession(state, { type: 'tick' })
    state = reduceBurgerSession(state, { type: 'tick' })
    expect(state.stations.grill.patty).toBe('cooked')

    state = reduceBurgerSession(state, { type: 'tick' })
    state = reduceBurgerSession(state, { type: 'tick' })
    state = reduceBurgerSession(state, { type: 'tick' })
    state = reduceBurgerSession(state, { type: 'tick' })
    state = reduceBurgerSession(state, { type: 'tick' })
    expect(state.stations.grill.patty).toBe('burnt')
    expect(state.log.at(-1)).toContain('burned on the grill.')
  })

  it('clears a burnt grill with an empty-hand interact and recovers', () => {
    let state = bootBurger()

    state = cookPatty(state)
    state = reduceBurgerSession(state, { type: 'tick' })
    state = reduceBurgerSession(state, { type: 'tick' })
    state = reduceBurgerSession(state, { type: 'tick' })
    state = reduceBurgerSession(state, { type: 'tick' })
    state = reduceBurgerSession(state, { type: 'tick' })
    expect(state.stations.grill.patty).toBe('burnt')

    state = reduceBurgerSession(state, { type: 'interact' })
    expect(state.stations.grill.patty).toBe('empty')
    expect(state.log.at(-1)).toContain('Cleared the burnt patty')

    state = move(state, 'left')
    state = move(state, 'down')
    state = reduceBurgerSession(state, { type: 'interact' })
    expect(state.player.heldItem).toBe('patty')
    expect(state.tick).toBeGreaterThan(0)
  })

  it('fails an order and continues with the next one', () => {
    let state = bootBurger()

    for (let index = 0; index < BURGER_LEVEL.orders[0].durationTicks; index += 1) {
      state = reduceBurgerSession(state, { type: 'tick' })
    }

    expect(state.phase).toBe('running')
    expect(state.shift.failedCount).toBe(1)
    expect(state.shift.servedCount).toBe(0)
    expect(state.currentOrder?.id).toBe('burger-order-2')
    expect(state.player.position).toEqual({ x: 1, y: 2 })
  })

  it('rejects the wrong recipe at the counter', () => {
    let state = bootBurger()

    state = runCheeseburgerFlow(state)
    state = startBurger(state)
    state = move(state, 'left')
    state = move(state, 'left')
    state = reduceBurgerSession(state, { type: 'interact' })
    state = move(state, 'right')
    state = move(state, 'right')
    state = reduceBurgerSession(state, { type: 'interact' })
    state = move(state, 'down')
    state = reduceBurgerSession(state, { type: 'interact' })
    state = move(state, 'up')
    state = reduceBurgerSession(state, { type: 'interact' })
    state = reduceBurgerSession(state, { type: 'interact' })
    state = move(state, 'right')
    state.player.heldItem = 'cheeseburger'
    state = reduceBurgerSession(state, { type: 'interact' })

    expect(state.phase).toBe('running')
    expect(state.score).toBe(1)
    expect(state.shift.servedCount).toBe(1)
    expect(state.currentOrder?.id).toBe('burger-order-2')
    expect(state.player.heldItem).toBeNull()
    expect(state.log.at(-1)).toContain('Counter rejected Cheeseburger. Need Plain burger.')
  })

  it('round-trips a checkpoint with player position and kitchen state', () => {
    let state = bootBurger()
    state = runCheeseburgerFlow(state)
    state = move(state, 'left')
    state = move(state, 'up')
    state = reduceBurgerSession(state, { type: 'interact' })
    state = reduceBurgerSession(state, { type: 'tick' })

    const checkpoint = createBurgerSessionCheckpoint('burger-runtime', state)
    const restored = restoreBurgerSessionCheckpoint('burger-runtime', checkpoint)

    expect(restored.shift.servedCount).toBe(1)
    expect(restored.currentOrder?.id).toBe('burger-order-2')
    expect(restored.tick).toBe(28)
    expect(restored.player.position).toEqual({ x: 0, y: 1 })
    expect(restored.player.facing).toBe('up')
    expect(restored.player.heldItem).toBe('bun')
    expect(restored.stations.grill.patty).toBe('empty')
  })

  it('rejects an old checkpoint version and restores the fresh session instead', () => {
    const checkpoint = createBurgerSessionCheckpoint('burger-runtime', {
      ...createInitialBurgerSessionState(),
      saveVersion: 3 as never,
      stations: {
        grill: { patty: 'burnt', progressTicks: 99 },
        board: { items: ['bun'] },
      },
    })

    const restored = restoreBurgerSessionCheckpoint('burger-runtime', checkpoint)

    expect(restored.saveVersion).toBe(4)
    expect(restored.stations.grill.patty).toBe('empty')
    expect(restored.stations.board.items).toEqual([])
  })
})
