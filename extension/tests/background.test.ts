import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { BackgroundMessage } from '../src/core/messages'

type Listener = (...args: unknown[]) => unknown

type BrowserMock = {
  tabs: { query: ReturnType<typeof vi.fn> }
  windows: { update: ReturnType<typeof vi.fn>; create: ReturnType<typeof vi.fn>; remove: ReturnType<typeof vi.fn>; onRemoved: { addListener: (fn: Listener) => void } }
  idle: {
    setDetectionInterval: ReturnType<typeof vi.fn>
    onStateChanged: { addListener: (fn: Listener) => void }
  }
  runtime: {
    onInstalled: { addListener: (fn: Listener) => void }
    onMessage: { addListener: (fn: Listener) => void }
  }
}

const state = vi.hoisted(() => ({
  DEFAULT_STATE: { armed: false, surfaceOpen: false, takeoverWindowId: null, waitingForActivity: false, lastIdleAt: null, lastTriggerAt: null, lastOpenAt: null, idleIntervalSeconds: 60 },
  IDLE_INTERVAL_SECONDS: 60,
  getState: vi.fn(),
  setState: vi.fn(),
  resetState: vi.fn(),
  triggerTakeover: vi.fn(),
  takeoverUrl: vi.fn(() => 'moz-extension://test/takeover.html'),
}))

vi.mock('../src/core/state', () => state)

function createBrowserMock() {
  const listeners: Record<string, Array<Listener>> = {
    installed: [],
    removed: [],
    idle: [],
    message: [],
  }

  return {
    listeners,
    browser: {
      tabs: { query: vi.fn() },
      windows: { update: vi.fn(), create: vi.fn(), remove: vi.fn(), onRemoved: { addListener: (fn: Listener) => listeners.removed.push(fn) } },
      idle: {
        setDetectionInterval: vi.fn(),
        onStateChanged: { addListener: (fn: Listener) => listeners.idle.push(fn) },
      },
      runtime: {
        onInstalled: { addListener: (fn: Listener) => listeners.installed.push(fn) },
        onMessage: { addListener: (fn: Listener) => listeners.message.push(fn) },
      },
    },
  }
}

describe('background', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it('syncs stored defaults on install and arms/disarms through messages', async () => {
    const mock = createBrowserMock()
    Object.assign(globalThis, { browser: mock.browser as BrowserMock })
    state.getState.mockResolvedValue({ armed: false, surfaceOpen: false, takeoverWindowId: null, waitingForActivity: false, lastIdleAt: null, lastTriggerAt: null, lastOpenAt: null, idleIntervalSeconds: 120 })
    state.setState.mockResolvedValue(undefined)
    state.resetState.mockImplementation(async (nextState: { idleIntervalSeconds: number }) => {
      await state.setState({ armed: false, surfaceOpen: false, takeoverWindowId: null, waitingForActivity: false, lastIdleAt: null, lastTriggerAt: null, lastOpenAt: null, idleIntervalSeconds: nextState.idleIntervalSeconds })
    })
    await import('../src/core/background')

    await mock.listeners.installed[0]()
    expect(state.setState).toHaveBeenCalledWith({ armed: false, surfaceOpen: false, takeoverWindowId: null, waitingForActivity: false, lastIdleAt: null, lastTriggerAt: null, lastOpenAt: null, idleIntervalSeconds: 120 })

    state.getState.mockResolvedValueOnce({ armed: false, surfaceOpen: false, takeoverWindowId: null, waitingForActivity: false, lastIdleAt: null, lastTriggerAt: null, lastOpenAt: null, idleIntervalSeconds: 120 })
    await mock.listeners.message[0]({ type: 'arm' } satisfies BackgroundMessage)
    expect(mock.browser.idle.setDetectionInterval).toHaveBeenCalledWith(120)
    expect(state.setState).toHaveBeenCalledWith({ armed: true, surfaceOpen: false, takeoverWindowId: null, waitingForActivity: false, lastIdleAt: null, lastTriggerAt: null, lastOpenAt: null, idleIntervalSeconds: 120 })

    state.getState.mockResolvedValueOnce({ armed: true, surfaceOpen: true, takeoverWindowId: 7, waitingForActivity: false, lastIdleAt: 1, lastTriggerAt: 2, lastOpenAt: 2, idleIntervalSeconds: 120 })
    await mock.listeners.message[0]({ type: 'disarm' } satisfies BackgroundMessage)
    expect(mock.browser.windows.remove).toHaveBeenCalledWith(7)
    expect(state.setState).toHaveBeenCalledWith({ armed: false, surfaceOpen: false, takeoverWindowId: null, waitingForActivity: false, lastIdleAt: null, lastTriggerAt: null, lastOpenAt: null, idleIntervalSeconds: 120 })
  })

  it('opens takeover tabs and clears state when tabs close', async () => {
    const mock = createBrowserMock()
    Object.assign(globalThis, { browser: mock.browser as BrowserMock })
    state.getState.mockResolvedValueOnce({ armed: true, surfaceOpen: false, takeoverWindowId: null, waitingForActivity: false, lastIdleAt: null, lastTriggerAt: null, lastOpenAt: null, idleIntervalSeconds: 60 })
    state.setState.mockResolvedValue(undefined)
    state.resetState.mockImplementation(async (nextState: { idleIntervalSeconds: number }) => {
      await state.setState({ armed: false, surfaceOpen: false, takeoverWindowId: null, waitingForActivity: false, lastIdleAt: null, lastTriggerAt: null, lastOpenAt: null, idleIntervalSeconds: nextState.idleIntervalSeconds })
    })
    mock.browser.tabs.query.mockResolvedValue([])
    mock.browser.windows.create.mockResolvedValue({ id: 42 })

    await import('../src/core/background')

    mock.listeners.idle[0]('idle')
    await vi.waitFor(() => expect(state.setState).toHaveBeenCalledWith({ armed: true, surfaceOpen: false, takeoverWindowId: null, waitingForActivity: true, lastIdleAt: expect.any(Number), lastTriggerAt: null, lastOpenAt: null, idleIntervalSeconds: 60 }))

    state.getState.mockResolvedValueOnce({ armed: true, surfaceOpen: false, takeoverWindowId: null, waitingForActivity: true, lastIdleAt: 1, lastTriggerAt: null, lastOpenAt: null, idleIntervalSeconds: 60 })
    mock.listeners.idle[0]('active')
    await vi.waitFor(() => expect(mock.browser.windows.create).toHaveBeenCalled())
    expect(mock.browser.windows.create).toHaveBeenCalledWith({ url: 'moz-extension://test/takeover.html', focused: true, type: 'popup' })
    expect(state.setState).toHaveBeenCalledWith({ armed: true, surfaceOpen: true, takeoverWindowId: 42, waitingForActivity: false, lastIdleAt: expect.any(Number), lastTriggerAt: expect.any(Number), lastOpenAt: expect.any(Number), idleIntervalSeconds: 60 })

    state.getState.mockResolvedValueOnce({ armed: true, surfaceOpen: true, takeoverWindowId: 42, waitingForActivity: false, lastIdleAt: null, lastTriggerAt: 1, lastOpenAt: 1, idleIntervalSeconds: 60 })
    await mock.listeners.removed[0](42)
    await vi.waitFor(() => expect(state.setState).toHaveBeenCalledTimes(2))
    expect(state.setState).toHaveBeenLastCalledWith({ armed: true, surfaceOpen: false, takeoverWindowId: null, waitingForActivity: false, lastIdleAt: null, lastTriggerAt: 1, lastOpenAt: 1, idleIntervalSeconds: 60 })
  })
})
