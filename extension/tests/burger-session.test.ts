import { describe, expect, it } from 'vitest'

import { createBurgerSessionCheckpoint, restoreBurgerSessionCheckpoint } from '../src/features/runtime-frame/checkpoint'
import { BURGER_LEVEL } from '../src/features/runtime-frame/burger-level'
import { reduceBurgerSession } from '../src/features/runtime-frame/burger-session-reducer'
import { createInitialBurgerSessionState } from '../src/features/runtime-frame/burger-session-state'

function bootBurger() {
  return reduceBurgerSession(createInitialBurgerSessionState(), { type: 'boot', checkpoint: null })
}

function extendTickets(state: ReturnType<typeof bootBurger>, ticks = 999) {
  return {
    ...state,
    activeOrders: state.activeOrders.map((order) => ({ ...order, remainingTicks: ticks })),
    upcomingOrders: state.upcomingOrders.map((order) => ({ ...order, durationTicks: ticks })),
  }
}

function move(state: ReturnType<typeof bootBurger>, direction: 'up' | 'down' | 'left' | 'right') {
  return reduceBurgerSession(state, { type: 'move', direction })
}

function cookPatty(state: ReturnType<typeof bootBurger>) {
  state = move(state, 'left')
  state = reduceBurgerSession(state, { type: 'interact' })
  state = move(state, 'right')
  state = move(state, 'up')
  state = reduceBurgerSession(state, { type: 'interact' })
  return state
}

describe('burger session reducer', () => {
  it('blocks movement into walls and requires adjacent interactables', () => {
    let state = bootBurger()

    state = reduceBurgerSession(state, { type: 'interact' })
    expect(state.log.at(-1)).toContain('Nothing is ready on the grill yet.')
    expect(state.tick).toBe(1)
    expect(state.activeOrders.map((order) => order.remainingTicks)).toEqual([
      BURGER_LEVEL.orders[0].durationTicks - 1,
      BURGER_LEVEL.orders[1].durationTicks - 1,
    ])

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
    expect(state.activeOrders[0].remainingTicks).toBe(BURGER_LEVEL.orders[0].durationTicks - 1)
    expect(state.activeOrders[1].remainingTicks).toBe(BURGER_LEVEL.orders[1].durationTicks - 1)

    state = reduceBurgerSession(state, { type: 'interact' })
    expect(state.tick).toBe(2)
    expect(state.activeOrders[0].remainingTicks).toBe(BURGER_LEVEL.orders[0].durationTicks - 2)

    state = reduceBurgerSession(state, { type: 'tick' })
    expect(state.tick).toBe(3)
    expect(state.activeOrders[0].remainingTicks).toBe(BURGER_LEVEL.orders[0].durationTicks - 3)
  })

  it('serves the full burger shift through the spatial kitchen', () => {
    let state = extendTickets(bootBurger())
    state = {
      ...state,
      activeOrders: [
        { ...state.activeOrders[0], recipeId: 'cheeseburger' },
        { ...state.activeOrders[1], recipeId: 'plain-burger' },
      ],
    }

    state.player.heldItem = 'cheeseburger'
    state.player.position = { x: 3, y: 1 }
    state.player.facing = 'right'
    state = reduceBurgerSession(state, { type: 'interact' })
    expect(state.phase).toBe('running')
    expect(state.score).toBe(1)
    expect(state.shift.servedCount).toBe(1)
    expect(state.activeOrders.map((order) => order.id)).toEqual(['burger-order-2', 'burger-order-3'])
    expect(state.stations.board.items).toEqual([])
    expect(state.stations.grill.patty).toBe('empty')

    state.player.heldItem = 'plain-burger'
    state = reduceBurgerSession(state, { type: 'interact' })
    expect(state.phase).toBe('running')
    expect(state.score).toBe(2)
    expect(state.shift.servedCount).toBe(2)
    expect(state.activeOrders.map((order) => order.id)).toEqual(['burger-order-3'])
    expect(state.stations.board.items).toEqual([])

    state.player.heldItem = 'cheeseburger'
    state = reduceBurgerSession(state, { type: 'interact' })
    expect(state.phase).toBe('completed')
    expect(state.score).toBe(3)
    expect(state.shift.servedCount).toBe(3)
    expect(state.shift.failedCount).toBe(0)
    expect(state.activeOrders).toEqual([])
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

    state = {
      ...state,
      activeOrders: [
        { ...state.activeOrders[0], remainingTicks: 1 },
        { ...state.activeOrders[1], remainingTicks: 8 },
      ],
      upcomingOrders: [{ ...state.upcomingOrders[0], durationTicks: 12 }],
    }

    state = reduceBurgerSession(state, { type: 'tick' })

    expect(state.phase).toBe('running')
    expect(state.shift.failedCount).toBe(1)
    expect(state.shift.servedCount).toBe(0)
    expect(state.activeOrders.map((order) => order.id)).toEqual(['burger-order-2', 'burger-order-3'])
    expect(state.player.position).toEqual({ x: 1, y: 2 })
    expect(state.stations.grill.patty).toBe('empty')
  })

  it('rejects the wrong recipe at the counter', () => {
    let state = extendTickets(bootBurger())
    state = {
      ...state,
      activeOrders: [
        { ...state.activeOrders[0], recipeId: 'plain-burger' },
        { ...state.activeOrders[1], recipeId: 'plain-burger' },
      ],
    }

    state.player.heldItem = 'cheeseburger'
    state.player.position = { x: 3, y: 1 }
    state.player.facing = 'right'
    state = reduceBurgerSession(state, { type: 'interact' })

    expect(state.phase).toBe('running')
    expect(state.score).toBe(0)
    expect(state.shift.servedCount).toBe(0)
    expect(state.activeOrders[0].id).toBe('burger-order-1')
    expect(state.player.heldItem).toBeNull()
    expect(state.log.at(-1)).toContain('Counter rejected Cheeseburger. Need Plain burger.')
  })

  it('round-trips a checkpoint with player position and kitchen state', () => {
    let state = extendTickets(bootBurger())
    state.player.heldItem = 'bun'
    state.stations.grill.patty = 'cooked'
    state.stations.grill.progressTicks = 2
    state.stations.board.items = ['bun', 'cooked-patty']
    state = move(state, 'right')

    const checkpoint = createBurgerSessionCheckpoint('burger-runtime', state)
    const restored = restoreBurgerSessionCheckpoint('burger-runtime', checkpoint)

    expect(restored.shift.servedCount).toBe(0)
    expect(restored.activeOrders.map((order) => order.id)).toEqual(['burger-order-1', 'burger-order-2'])
    expect(restored.tick).toBe(state.tick)
    expect(restored.player.position).toEqual(state.player.position)
    expect(restored.player.facing).toBe('right')
    expect(restored.player.heldItem).toBe('bun')
    expect(restored.stations.grill.patty).toBe('cooked')
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

    expect(restored.saveVersion).toBe(5)
    expect(restored.stations.grill.patty).toBe('empty')
    expect(restored.stations.board.items).toEqual([])
  })
})
