import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { BackgroundMessage } from '../src/core/messages'

type Listener = (...args: unknown[]) => unknown

type BrowserMock = {
  tabs: {
    query: ReturnType<typeof vi.fn>
    create: ReturnType<typeof vi.fn>
    update: ReturnType<typeof vi.fn>
    remove: ReturnType<typeof vi.fn>
    onRemoved: { addListener: (fn: Listener) => void }
  }
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
  DEFAULT_STATE: { armed: false, surfaceOpen: false, activeSurface: null, hostWindowId: null, hostTabId: null, waitingForActivity: false, lastIdleAt: null, lastTriggerAt: null, lastOpenAt: null, idleIntervalSeconds: 60 },
  IDLE_INTERVAL_SECONDS: 60,
  getState: vi.fn(),
  setState: vi.fn(),
  resetState: vi.fn(),
  takeoverUrl: vi.fn((surface = 'popup-window') => `moz-extension://test/takeover.html?surface=${surface}`),
}))

const runtimeHost = vi.hoisted(() => ({
  clearRuntimeHostSession: vi.fn(),
}))

vi.mock('../src/core/state', () => state)
vi.mock('../src/features/runtime-host/checkpoint-store', () => runtimeHost)

function createBrowserMock() {
  const listeners: Record<string, Array<Listener>> = {
    installed: [],
    removed: [],
    tabRemoved: [],
    idle: [],
    message: [],
  }

  return {
    listeners,
    browser: {
      tabs: {
        query: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        remove: vi.fn(),
        onRemoved: { addListener: (fn: Listener) => listeners.tabRemoved.push(fn) },
      },
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
    state.getState.mockResolvedValue({ armed: false, surfaceOpen: false, activeSurface: null, hostWindowId: null, hostTabId: null, waitingForActivity: false, lastIdleAt: null, lastTriggerAt: null, lastOpenAt: null, idleIntervalSeconds: 120 })
    state.setState.mockResolvedValue(undefined)
    runtimeHost.clearRuntimeHostSession.mockResolvedValue(undefined)
    state.resetState.mockImplementation(async (nextState: { idleIntervalSeconds: number }) => {
      await state.setState({ armed: false, surfaceOpen: false, activeSurface: null, hostWindowId: null, hostTabId: null, waitingForActivity: false, lastIdleAt: null, lastTriggerAt: null, lastOpenAt: null, idleIntervalSeconds: nextState.idleIntervalSeconds })
    })
    await import('../src/core/background')

    await mock.listeners.installed[0]()
    expect(state.setState).toHaveBeenCalledWith({ armed: false, surfaceOpen: false, activeSurface: null, hostWindowId: null, hostTabId: null, waitingForActivity: false, lastIdleAt: null, lastTriggerAt: null, lastOpenAt: null, idleIntervalSeconds: 120 })

    state.getState.mockResolvedValueOnce({ armed: false, surfaceOpen: false, activeSurface: null, hostWindowId: null, hostTabId: null, waitingForActivity: false, lastIdleAt: null, lastTriggerAt: null, lastOpenAt: null, idleIntervalSeconds: 120 })
    await mock.listeners.message[0]({ type: 'arm' } satisfies BackgroundMessage)
    expect(mock.browser.idle.setDetectionInterval).toHaveBeenCalledWith(120)
    expect(state.setState).toHaveBeenCalledWith({ armed: true, surfaceOpen: false, activeSurface: null, hostWindowId: null, hostTabId: null, waitingForActivity: false, lastIdleAt: null, lastTriggerAt: null, lastOpenAt: null, idleIntervalSeconds: 120 })

    state.getState.mockResolvedValueOnce({ armed: true, surfaceOpen: true, activeSurface: 'popup-window', hostWindowId: 7, hostTabId: null, waitingForActivity: false, lastIdleAt: 1, lastTriggerAt: 2, lastOpenAt: 2, idleIntervalSeconds: 120 })
    await mock.listeners.message[0]({ type: 'disarm' } satisfies BackgroundMessage)
    expect(mock.browser.windows.remove).toHaveBeenCalledWith(7)
    expect(state.setState).toHaveBeenCalledWith({ armed: false, surfaceOpen: false, activeSurface: null, hostWindowId: null, hostTabId: null, waitingForActivity: false, lastIdleAt: null, lastTriggerAt: null, lastOpenAt: null, idleIntervalSeconds: 120 })

    state.getState.mockResolvedValueOnce({ armed: true, surfaceOpen: true, activeSurface: 'popup-window', hostWindowId: 7, hostTabId: null, waitingForActivity: false, lastIdleAt: 1, lastTriggerAt: 2, lastOpenAt: 2, idleIntervalSeconds: 120 })
    await mock.listeners.message[0]({ type: 'reset' } satisfies BackgroundMessage)
    expect(runtimeHost.clearRuntimeHostSession).toHaveBeenCalledTimes(1)
    expect(runtimeHost.clearRuntimeHostSession).toHaveBeenCalledWith('burger-runtime')
  })

  it('still resets extension state when clearing runtime host state fails', async () => {
    const mock = createBrowserMock()
    Object.assign(globalThis, { browser: mock.browser as BrowserMock })
    state.getState.mockResolvedValue({ armed: true, surfaceOpen: true, activeSurface: 'popup-window', hostWindowId: 7, hostTabId: null, waitingForActivity: false, lastIdleAt: 1, lastTriggerAt: 2, lastOpenAt: 2, idleIntervalSeconds: 120 })
    state.setState.mockResolvedValue(undefined)
    runtimeHost.clearRuntimeHostSession.mockRejectedValue(new Error('boom'))
    state.resetState.mockImplementation(async (nextState: { idleIntervalSeconds: number }) => {
      await state.setState({ armed: false, surfaceOpen: false, activeSurface: null, hostWindowId: null, hostTabId: null, waitingForActivity: false, lastIdleAt: null, lastTriggerAt: null, lastOpenAt: null, idleIntervalSeconds: nextState.idleIntervalSeconds })
    })

    await import('../src/core/background')

    await mock.listeners.message[0]({ type: 'reset' } satisfies BackgroundMessage)

    expect(runtimeHost.clearRuntimeHostSession).toHaveBeenCalledWith('burger-runtime')
    expect(state.setState).toHaveBeenCalledWith({ armed: false, surfaceOpen: false, activeSurface: null, hostWindowId: null, hostTabId: null, waitingForActivity: false, lastIdleAt: null, lastTriggerAt: null, lastOpenAt: null, idleIntervalSeconds: 120 })
  })

  it('opens the popup-window host and clears state when the window closes', async () => {
    const mock = createBrowserMock()
    Object.assign(globalThis, { browser: mock.browser as BrowserMock })
    state.getState.mockResolvedValueOnce({ armed: true, surfaceOpen: false, activeSurface: null, hostWindowId: null, hostTabId: null, waitingForActivity: false, lastIdleAt: null, lastTriggerAt: null, lastOpenAt: null, idleIntervalSeconds: 60 })
    state.setState.mockResolvedValue(undefined)
    runtimeHost.clearRuntimeHostSession.mockResolvedValue(undefined)
    state.resetState.mockImplementation(async (nextState: { idleIntervalSeconds: number }) => {
      await state.setState({ armed: false, surfaceOpen: false, activeSurface: null, hostWindowId: null, hostTabId: null, waitingForActivity: false, lastIdleAt: null, lastTriggerAt: null, lastOpenAt: null, idleIntervalSeconds: nextState.idleIntervalSeconds })
    })
    mock.browser.tabs.query.mockResolvedValue([])
    mock.browser.windows.create.mockResolvedValue({ id: 42 })

    await import('../src/core/background')

    mock.listeners.idle[0]('idle')
    await vi.waitFor(() => expect(state.setState).toHaveBeenCalledWith({ armed: true, surfaceOpen: false, activeSurface: null, hostWindowId: null, hostTabId: null, waitingForActivity: true, lastIdleAt: expect.any(Number), lastTriggerAt: null, lastOpenAt: null, idleIntervalSeconds: 60 }))

    state.getState.mockResolvedValueOnce({ armed: true, surfaceOpen: false, activeSurface: null, hostWindowId: null, hostTabId: null, waitingForActivity: true, lastIdleAt: 1, lastTriggerAt: null, lastOpenAt: null, idleIntervalSeconds: 60 })
    mock.listeners.idle[0]('active')
    await vi.waitFor(() => expect(mock.browser.windows.create).toHaveBeenCalled())
    expect(mock.browser.windows.create).toHaveBeenCalledWith({ url: 'moz-extension://test/takeover.html?surface=popup-window', focused: true, type: 'popup', width: 1100, height: 820 })
    expect(state.setState).toHaveBeenCalledWith({ armed: true, surfaceOpen: true, activeSurface: 'popup-window', hostWindowId: 42, hostTabId: null, waitingForActivity: false, lastIdleAt: expect.any(Number), lastTriggerAt: expect.any(Number), lastOpenAt: expect.any(Number), idleIntervalSeconds: 60 })

    state.getState.mockResolvedValueOnce({ armed: true, surfaceOpen: true, activeSurface: 'popup-window', hostWindowId: 42, hostTabId: null, waitingForActivity: false, lastIdleAt: null, lastTriggerAt: 1, lastOpenAt: 1, idleIntervalSeconds: 60 })
    await mock.listeners.removed[0](42)
    await vi.waitFor(() => expect(state.setState).toHaveBeenCalledTimes(2))
    expect(state.setState).toHaveBeenLastCalledWith({ armed: true, surfaceOpen: false, activeSurface: null, hostWindowId: null, hostTabId: null, waitingForActivity: false, lastIdleAt: null, lastTriggerAt: 1, lastOpenAt: 1, idleIntervalSeconds: 60 })
  })

  it('opens and tracks the full-tab host directly', async () => {
    const mock = createBrowserMock()
    Object.assign(globalThis, { browser: mock.browser as BrowserMock })
    state.getState.mockResolvedValueOnce({ armed: true, surfaceOpen: false, activeSurface: null, hostWindowId: null, hostTabId: null, waitingForActivity: false, lastIdleAt: null, lastTriggerAt: null, lastOpenAt: null, idleIntervalSeconds: 60 })
    state.setState.mockResolvedValue(undefined)
    mock.browser.tabs.query.mockResolvedValue([])
    mock.browser.tabs.create.mockResolvedValue({ id: 55, windowId: 88 })

    await import('../src/core/background')

    await mock.listeners.message[0]({ type: 'open-full-tab' } satisfies BackgroundMessage)

    expect(mock.browser.tabs.create).toHaveBeenCalledWith({ url: 'moz-extension://test/takeover.html?surface=full-tab', active: true })
    expect(mock.browser.windows.update).toHaveBeenCalledWith(88, { focused: true })
    expect(state.setState).toHaveBeenCalledWith({ armed: true, surfaceOpen: true, activeSurface: 'full-tab', hostWindowId: null, hostTabId: 55, waitingForActivity: false, lastIdleAt: null, lastTriggerAt: expect.any(Number), lastOpenAt: expect.any(Number), idleIntervalSeconds: 60 })

    state.getState.mockResolvedValueOnce({ armed: true, surfaceOpen: true, activeSurface: 'full-tab', hostWindowId: null, hostTabId: 55, waitingForActivity: false, lastIdleAt: null, lastTriggerAt: 1, lastOpenAt: 1, idleIntervalSeconds: 60 })
    await mock.listeners.tabRemoved[0](55)
    await vi.waitFor(() => {
      expect(state.setState).toHaveBeenLastCalledWith({ armed: true, surfaceOpen: false, activeSurface: null, hostWindowId: null, hostTabId: null, waitingForActivity: false, lastIdleAt: null, lastTriggerAt: 1, lastOpenAt: 1, idleIntervalSeconds: 60 })
    })
  })

  it('does not open a second host when a popup-window host is already active', async () => {
    const mock = createBrowserMock()
    Object.assign(globalThis, { browser: mock.browser as BrowserMock })
    state.getState.mockResolvedValueOnce({ armed: true, surfaceOpen: true, activeSurface: 'popup-window', hostWindowId: 42, hostTabId: null, waitingForActivity: false, lastIdleAt: null, lastTriggerAt: 1, lastOpenAt: 1, idleIntervalSeconds: 60 })

    await import('../src/core/background')

    await mock.listeners.message[0]({ type: 'open-full-tab' } satisfies BackgroundMessage)

    expect(mock.browser.tabs.create).not.toHaveBeenCalled()
  })

  it('closes only the active surface without disarming the trigger', async () => {
    const mock = createBrowserMock()
    Object.assign(globalThis, { browser: mock.browser as BrowserMock })
    state.getState.mockResolvedValueOnce({ armed: true, surfaceOpen: true, activeSurface: 'full-tab', hostWindowId: null, hostTabId: 55, waitingForActivity: false, lastIdleAt: null, lastTriggerAt: 1, lastOpenAt: 1, idleIntervalSeconds: 60 })
    state.setState.mockResolvedValue(undefined)

    await import('../src/core/background')

    await mock.listeners.message[0]({ type: 'close-surface' } satisfies BackgroundMessage)

    expect(mock.browser.tabs.remove).toHaveBeenCalledWith(55)
    expect(state.setState).toHaveBeenCalledWith({ armed: true, surfaceOpen: false, activeSurface: null, hostWindowId: null, hostTabId: null, waitingForActivity: false, lastIdleAt: null, lastTriggerAt: 1, lastOpenAt: 1, idleIntervalSeconds: 60 })
  })
})
