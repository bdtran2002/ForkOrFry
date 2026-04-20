import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { BackgroundMessage } from '../src/shared'

type Listener = (...args: unknown[]) => unknown

type BrowserMock = {
  tabs: {
    query: ReturnType<typeof vi.fn>
    update: ReturnType<typeof vi.fn>
    create: ReturnType<typeof vi.fn>
    remove: ReturnType<typeof vi.fn>
    onRemoved: { addListener: (fn: Listener) => void }
  }
  windows: { update: ReturnType<typeof vi.fn> }
  idle: {
    setDetectionInterval: ReturnType<typeof vi.fn>
    onStateChanged: { addListener: (fn: Listener) => void }
  }
  runtime: {
    onInstalled: { addListener: (fn: Listener) => void }
    onMessage: { addListener: (fn: Listener) => void }
  }
}

const shared = vi.hoisted(() => ({
  DEFAULT_STATE: { armed: false, takeoverTabId: null, lastIdleAt: null, idleIntervalSeconds: 60 },
  IDLE_INTERVAL_SECONDS: 60,
  getState: vi.fn(),
  setState: vi.fn(),
  resetState: vi.fn(),
  triggerTakeover: vi.fn(),
  takeoverUrl: vi.fn(() => 'moz-extension://test/takeover.html'),
}))

vi.mock('../src/shared', () => shared)

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
      tabs: {
        query: vi.fn(),
        update: vi.fn(),
        create: vi.fn(),
        remove: vi.fn(),
        onRemoved: { addListener: (fn: Listener) => listeners.removed.push(fn) },
      },
      windows: { update: vi.fn() },
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
    shared.getState.mockResolvedValue({ armed: false, takeoverTabId: null, lastIdleAt: null, idleIntervalSeconds: 120 })
    shared.setState.mockResolvedValue(undefined)
    shared.resetState.mockImplementation(async (state: { idleIntervalSeconds: number }) => {
      await shared.setState({ armed: false, takeoverTabId: null, lastIdleAt: null, idleIntervalSeconds: state.idleIntervalSeconds })
    })
    shared.triggerTakeover.mockImplementation(async (state: { armed: boolean; takeoverTabId: number | null; lastIdleAt: number | null; idleIntervalSeconds: number }) => {
      const tabs = await mock.browser.tabs.query({ url: 'moz-extension://test/takeover.html' })
      const existing = tabs[0]
      const takeoverTabId = existing?.id ?? (await mock.browser.tabs.create({ url: 'moz-extension://test/takeover.html', active: true })).id ?? null
      await shared.setState({ ...state, lastIdleAt: Date.now(), takeoverTabId })
    })

    await import('../src/background')

    await mock.listeners.installed[0]()
    expect(shared.setState).toHaveBeenCalledWith({ armed: false, takeoverTabId: null, lastIdleAt: null, idleIntervalSeconds: 120 })

    shared.getState.mockResolvedValueOnce({ armed: false, takeoverTabId: null, lastIdleAt: null, idleIntervalSeconds: 120 })
    await mock.listeners.message[0]({ type: 'arm' } satisfies BackgroundMessage)
    expect(mock.browser.idle.setDetectionInterval).toHaveBeenCalledWith(120)
    expect(shared.setState).toHaveBeenCalledWith({ armed: true, takeoverTabId: null, lastIdleAt: null, idleIntervalSeconds: 120 })

    shared.getState.mockResolvedValueOnce({ armed: true, takeoverTabId: 7, lastIdleAt: 1, idleIntervalSeconds: 120 })
    await mock.listeners.message[0]({ type: 'disarm' } satisfies BackgroundMessage)
    expect(mock.browser.tabs.remove).toHaveBeenCalledWith(7)
    expect(shared.setState).toHaveBeenCalledWith({ armed: false, takeoverTabId: null, lastIdleAt: null, idleIntervalSeconds: 120 })
  })

  it('opens takeover tabs and clears state when tabs close', async () => {
    const mock = createBrowserMock()
    Object.assign(globalThis, { browser: mock.browser as BrowserMock })
    shared.getState.mockResolvedValue({ armed: true, takeoverTabId: null, lastIdleAt: null, idleIntervalSeconds: 60 })
    shared.setState.mockResolvedValue(undefined)
    shared.resetState.mockImplementation(async (state: { idleIntervalSeconds: number }) => {
      await shared.setState({ armed: false, takeoverTabId: null, lastIdleAt: null, idleIntervalSeconds: state.idleIntervalSeconds })
    })
    shared.triggerTakeover.mockImplementation(async (state: { armed: boolean; takeoverTabId: number | null; lastIdleAt: number | null; idleIntervalSeconds: number }) => {
      const tabs = await mock.browser.tabs.query({ url: 'moz-extension://test/takeover.html' })
      const existing = tabs[0]
      const takeoverTabId = existing?.id ?? (await mock.browser.tabs.create({ url: 'moz-extension://test/takeover.html', active: true })).id ?? null
      await shared.setState({ ...state, lastIdleAt: Date.now(), takeoverTabId })
    })
    mock.browser.tabs.query.mockResolvedValue([])
    mock.browser.tabs.create.mockResolvedValue({ id: 42 })

    await import('../src/background')

    mock.listeners.idle[0]('idle')
    await vi.waitFor(() => expect(mock.browser.tabs.create).toHaveBeenCalled())
    expect(mock.browser.tabs.create).toHaveBeenCalledWith({ url: 'moz-extension://test/takeover.html', active: true })
    expect(shared.setState).toHaveBeenCalledWith({ armed: true, takeoverTabId: 42, lastIdleAt: expect.any(Number), idleIntervalSeconds: 60 })

    shared.getState.mockResolvedValueOnce({ armed: true, takeoverTabId: 42, lastIdleAt: null, idleIntervalSeconds: 60 })
    await mock.listeners.removed[0](42)
    await vi.waitFor(() => expect(shared.setState).toHaveBeenCalledTimes(2))
    expect(shared.setState).toHaveBeenLastCalledWith({ armed: true, takeoverTabId: null, lastIdleAt: null, idleIntervalSeconds: 60 })
  })
})
