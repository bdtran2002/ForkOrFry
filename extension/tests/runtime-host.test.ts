// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'

type BrowserMock = {
  storage: {
    local: {
      get: ReturnType<typeof vi.fn>
      set: ReturnType<typeof vi.fn>
      remove: ReturnType<typeof vi.fn>
    }
  }
}

function createBrowserMock() {
  const storage = new Map<string, unknown>()

  return {
    browser: {
      storage: {
        local: {
          get: vi.fn(async (key: string) => ({ [key]: storage.get(key) })),
          set: vi.fn(async (values: Record<string, unknown>) => {
            for (const [key, value] of Object.entries(values)) storage.set(key, value)
          }),
          remove: vi.fn(async (key: string) => {
            storage.delete(key)
          }),
        },
      },
    },
  }
}

describe('runtime host', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    document.body.innerHTML = ''
  })

  it('stores a versioned runtime checkpoint and bumps resume count on reopen', async () => {
    const mock = createBrowserMock()
    Object.assign(globalThis, { browser: mock.browser as BrowserMock })

    const {
      clearRuntimeHostSession,
      getRuntimeHostSession,
      openRuntimeHostSession,
      saveRuntimeCheckpoint,
    } = await import('../src/features/runtime-host/checkpoint-store')

    const first = await openRuntimeHostSession('burger-runtime')
    expect(first.resumeCount).toBe(0)

    await saveRuntimeCheckpoint('burger-runtime', {
      version: 1,
      runtimeId: 'burger-runtime',
      updatedAt: 123,
      state: { saveVersion: 1, levelId: 'burger', tick: 2 },
    })

    const reopened = await openRuntimeHostSession('burger-runtime')
    expect(reopened.resumeCount).toBe(1)
    expect(reopened.checkpoint?.state).toEqual({ saveVersion: 1, levelId: 'burger', tick: 2 })

    await clearRuntimeHostSession()
    const cleared = await getRuntimeHostSession('burger-runtime')
    expect(cleared.checkpoint).toBeNull()
    expect(cleared.resumeCount).toBe(0)
  })

  it('boots the child runtime and persists runtime messages through the controller', async () => {
    const mock = createBrowserMock()
    Object.assign(globalThis, { browser: mock.browser as BrowserMock })

    const runtimeWindow = { postMessage: vi.fn() } as unknown as Window
    const frame = document.createElement('iframe')
    const mountRuntime = vi.fn().mockResolvedValue({ frame, runtimeWindow })
    const sessionUpdates: string[] = []

    const { getRuntimeHostSession } = await import('../src/features/runtime-host/checkpoint-store')
    const { createRuntimeHostController } = await import('../src/features/runtime-host/controller')

    const controller = createRuntimeHostController({
      runtimeId: 'burger-runtime',
      mountRuntime,
      onSessionChange: (session) => {
        sessionUpdates.push(session.status)
      },
    })

    await controller.start()

    expect(mountRuntime).toHaveBeenCalledWith({ reset: false })
    expect(runtimeWindow.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'host:boot', runtimeId: 'burger-runtime' }),
      window.location.origin,
    )

    window.dispatchEvent(
      new MessageEvent('message', {
        source: runtimeWindow as MessageEventSource,
        origin: window.location.origin,
        data: {
          type: 'runtime:checkpoint',
          runtimeId: 'burger-runtime',
          checkpoint: {
            version: 1,
            runtimeId: 'burger-runtime',
            updatedAt: 321,
            state: { saveVersion: 1, levelId: 'burger', tick: 1, phase: 'running' },
          },
        },
      }),
    )

    await vi.waitFor(async () => {
      const session = await getRuntimeHostSession('burger-runtime')
      expect(session.checkpoint?.state).toEqual({ saveVersion: 1, levelId: 'burger', tick: 1, phase: 'running' })
    })

    window.dispatchEvent(
      new MessageEvent('message', {
        source: runtimeWindow as MessageEventSource,
        origin: window.location.origin,
        data: {
          type: 'runtime:ready',
          runtimeId: 'burger-runtime',
          capabilities: ['checkpoint', 'pause', 'resume', 'local-session'],
        },
      }),
    )

    await vi.waitFor(async () => {
      const session = await getRuntimeHostSession('burger-runtime')
      expect(session.status).toBe('ready')
    })

    await controller.pause('Host window hidden.')
    expect(runtimeWindow.postMessage).toHaveBeenCalledWith(
      { type: 'host:pause', runtimeId: 'burger-runtime', reason: 'Host window hidden.' },
      window.location.origin,
    )

    await controller.resume()
    expect(runtimeWindow.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'host:resume', runtimeId: 'burger-runtime' }),
      window.location.origin,
    )

    await controller.shutdown()
    expect(runtimeWindow.postMessage).toHaveBeenCalledWith(
      { type: 'host:shutdown', runtimeId: 'burger-runtime' },
      window.location.origin,
    )
    expect(sessionUpdates).toContain('ready')
  })
})
