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

function createActiveOrder(id: string, recipeId: 'plain-burger' | 'cheeseburger', remainingTicks = 999, durationTicks = 999) {
  return { id, recipeId, remainingTicks, durationTicks }
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

    expect(state.activeOrders.map((order) => order.id)).toEqual(['burger-order-1'])
    expect(state.upcomingOrders.map((order) => order.id)).toEqual(['burger-order-2', 'burger-order-3'])

    state = reduceBurgerSession(state, { type: 'interact' })
    expect(state.log.at(-1)).toContain('Nothing is ready on the grill yet.')
    expect(state.tick).toBe(1)
    expect(state.activeOrders.map((order) => order.remainingTicks)).toEqual([BURGER_LEVEL.orders[0].durationTicks - 1])

    state = move(state, 'left')
    state = move(state, 'up')
    state = move(state, 'up')
    expect(state.player.position).toEqual({ x: 0, y: 1 })
    expect(state.player.facing).toBe('up')
    expect(state.log.some((entry) => entry.includes('That path is blocked.'))).toBe(true)
    expect(state.tick).toBe(4)
    expect(state.activeOrders.map((order) => order.id)).toEqual(['burger-order-1', 'burger-order-2'])
  
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
    expect(state.activeOrders).toHaveLength(1)

    state = reduceBurgerSession(state, { type: 'interact' })
    expect(state.tick).toBe(2)
    expect(state.activeOrders[0].remainingTicks).toBe(BURGER_LEVEL.orders[0].durationTicks - 2)

    state = reduceBurgerSession(state, { type: 'tick' })
    expect(state.tick).toBe(3)
    expect(state.activeOrders[0].remainingTicks).toBe(BURGER_LEVEL.orders[0].durationTicks - 3)
  })

  it('promotes scheduled tickets only when their release tick arrives', () => {
    let state = bootBurger()

    expect(state.activeOrders.map((order) => order.id)).toEqual(['burger-order-1'])

    state = reduceBurgerSession(state, { type: 'tick' })
    state = reduceBurgerSession(state, { type: 'tick' })
    state = reduceBurgerSession(state, { type: 'tick' })
    expect(state.activeOrders.map((order) => order.id)).toEqual(['burger-order-1'])
    expect(state.phase).toBe('running')

    state = reduceBurgerSession(state, { type: 'tick' })
    expect(state.activeOrders.map((order) => order.id)).toEqual(['burger-order-1', 'burger-order-2'])
  })

  it('serves the full burger shift through the spatial kitchen', () => {
    let state = extendTickets(bootBurger())
    state = {
      ...state,
      activeOrders: [
        createActiveOrder('burger-order-1', 'cheeseburger'),
        createActiveOrder('burger-order-2', 'plain-burger'),
      ],
      upcomingOrders: [{ ...state.upcomingOrders[1], durationTicks: 999, releaseTick: 0 }],
    }

    state.player.heldItem = 'cheeseburger'
    state.player.position = { x: 3, y: 1 }
    state.player.facing = 'right'
    state = reduceBurgerSession(state, { type: 'interact' })
    expect(state.phase).toBe('running')
    expect(state.score).toBe(1)
    expect(state.shift.servedCount).toBe(1)
    expect(state.activeOrders.map((order) => order.id)).toEqual(['burger-order-2', 'burger-order-3'])
    expect(state.stations.board.item).toBeNull()
    expect(state.stations.grill.patty).toBe('empty')

    state.player.heldItem = 'plain-burger'
    state = reduceBurgerSession(state, { type: 'interact' })
    expect(state.phase).toBe('running')
    expect(state.score).toBe(2)
    expect(state.shift.servedCount).toBe(2)
    expect(state.activeOrders.map((order) => order.id)).toEqual(['burger-order-3'])
    expect(state.stations.board.item).toBeNull()

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
      tick: 12,
      activeOrders: [
        createActiveOrder('burger-order-1', 'cheeseburger', 1, 12),
        createActiveOrder('burger-order-2', 'plain-burger', 8, 12),
      ],
      upcomingOrders: [{ id: 'burger-order-3', recipeId: 'cheeseburger', durationTicks: 12, releaseTick: 12 }],
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
    expect(state.stations.counter.item).toBe('cheeseburger')
    expect(state.log.at(-1)).toContain('Staged Cheeseburger on the counter.')
  })

  it('stages a finished burger during a lull and picks it back up', () => {
    let state = extendTickets(bootBurger())
    state = {
      ...state,
      activeOrders: [],
    }

    state.player.heldItem = 'cheeseburger'
    state.player.position = { x: 3, y: 1 }
    state.player.facing = 'right'
    state = reduceBurgerSession(state, { type: 'interact' })

    expect(state.player.heldItem).toBeNull()
    expect(state.stations.counter.item).toBe('cheeseburger')
    expect(state.log.at(-1)).toContain('Staged Cheeseburger on the counter.')

    state = reduceBurgerSession(state, { type: 'interact' })

    expect(state.player.heldItem).toBe('cheeseburger')
    expect(state.stations.counter.item).toBeNull()
    expect(state.log.at(-1)).toContain('Picked up Cheeseburger from the counter.')
  })

  it('serves from the counter when a live matching ticket exists', () => {
    let state = extendTickets(bootBurger())
    state = {
      ...state,
      activeOrders: [createActiveOrder('burger-order-1', 'cheeseburger')],
    }

    state.player.heldItem = 'cheeseburger'
    state.player.position = { x: 3, y: 1 }
    state.player.facing = 'right'
    state = reduceBurgerSession(state, { type: 'interact' })

    expect(state.player.heldItem).toBeNull()
    expect(state.stations.counter.item).toBeNull()
    expect(state.shift.servedCount).toBe(1)
  })

  it('does not destroy a burger when the counter interaction is wrong', () => {
    let state = extendTickets(bootBurger())
    state = {
      ...state,
      activeOrders: [createActiveOrder('burger-order-1', 'plain-burger')],
      stations: { ...state.stations, counter: { finishedBurger: 'cheeseburger' as const, item: 'cheeseburger' as const } },
    }

    state.player.heldItem = null
    state.player.position = { x: 3, y: 1 }
    state.player.facing = 'right'
    state = reduceBurgerSession(state, { type: 'interact' })

    expect(state.player.heldItem).toBe('cheeseburger')
    expect(state.stations.counter.item).toBeNull()
  })

  it('round-trips a checkpoint with player position and kitchen state', () => {
    let state = extendTickets(bootBurger())
    state.player.heldItem = 'bun'
    state.stations.grill.patty = 'cooked'
    state.stations.grill.progressTicks = 2
    state.stations.board.item = { kind: 'partial-burger', ingredients: ['bun', 'cooked-patty'] as const } as never
    state = move(state, 'right')

    const checkpoint = createBurgerSessionCheckpoint('burger-runtime', state)
    const restored = restoreBurgerSessionCheckpoint('burger-runtime', checkpoint)

    expect(restored.shift.servedCount).toBe(0)
    expect(restored.activeOrders.map((order) => order.id)).toEqual(['burger-order-1'])
    expect(restored.tick).toBe(state.tick)
    expect(restored.player.position).toEqual(state.player.position)
    expect(restored.player.facing).toBe('right')
    expect(restored.player.heldItem).toBe('bun')
    expect(restored.stations.grill.patty).toBe('cooked')
  })

  it('round-trips the counter staging state in a checkpoint', () => {
    const state = {
      ...extendTickets(bootBurger()),
      stations: { ...bootBurger().stations, counter: { finishedBurger: 'cheeseburger' as const, item: 'cheeseburger' as const } },
    }

    const checkpoint = createBurgerSessionCheckpoint('burger-runtime', state)
    const restored = restoreBurgerSessionCheckpoint('burger-runtime', checkpoint)

    expect(restored.saveVersion).toBe(8)
    expect(restored.stations.counter.item).toBe('cheeseburger')
  })

  it('rejects an old checkpoint version and restores the fresh session instead', () => {
    const checkpoint = createBurgerSessionCheckpoint('burger-runtime', {
      ...createInitialBurgerSessionState(),
      saveVersion: 3 as never,
      stations: {
        grill: { patty: 'burnt', progressTicks: 99 },
        board: { items: ['bun'], item: { kind: 'partial-burger', ingredients: ['bun'] as const } as never },
        counter: { finishedBurger: null, item: null },
      },
    })

    const restored = restoreBurgerSessionCheckpoint('burger-runtime', checkpoint)

    expect(restored.saveVersion).toBe(8)
    expect(restored.stations.grill.patty).toBe('empty')
    expect(restored.stations.board.item).toBeNull()
  })

  it('supports partial build pickup, restage, and completion on the board', () => {
    let state = extendTickets(bootBurger())
    state = { ...state, activeOrders: [] }

    state.player.heldItem = 'bun'
    state.player.position = { x: 2, y: 1 }
    state.player.facing = 'right'
    state = reduceBurgerSession(state, { type: 'interact' })

    expect(state.player.heldItem).toBeNull()
    expect(state.stations.board.item).toEqual({ kind: 'partial-burger', ingredients: ['bun'] })

    state = reduceBurgerSession(state, { type: 'interact' })
    expect(state.player.heldItem).toEqual({ kind: 'partial-burger', ingredients: ['bun'] })
    expect(state.stations.board.item).toBeNull()

    state = reduceBurgerSession(state, { type: 'interact' })
    expect(state.stations.board.item).toEqual({ kind: 'partial-burger', ingredients: ['bun'] })

    state.player.heldItem = 'cooked-patty'
    state = reduceBurgerSession(state, { type: 'interact' })
    expect(state.stations.board.item).toBe('plain-burger')

    state = reduceBurgerSession(state, { type: 'interact' })
    expect(state.player.heldItem).toBe('plain-burger')
    expect(state.stations.board.item).toBeNull()
  })

  it('stages partial builds on the counter and serves only completed live orders', () => {
    let state = extendTickets(bootBurger())
    state = { ...state, activeOrders: [createActiveOrder('burger-order-1', 'plain-burger')] }

    state.player.heldItem = { kind: 'partial-burger', ingredients: ['bun'] }
    state.player.position = { x: 3, y: 1 }
    state.player.facing = 'right'
    state = reduceBurgerSession(state, { type: 'interact' })

    expect(state.player.heldItem).toBeNull()
    expect(state.stations.counter.item).toEqual({ kind: 'partial-burger', ingredients: ['bun'] })

    state = reduceBurgerSession(state, { type: 'interact' })
    expect(state.player.heldItem).toEqual({ kind: 'partial-burger', ingredients: ['bun'] })

    state.player.heldItem = 'plain-burger'
    state = reduceBurgerSession(state, { type: 'interact' })
    expect(state.shift.servedCount).toBe(1)
    expect(state.score).toBe(1)
    expect(state.player.heldItem).toBeNull()
  })
})
