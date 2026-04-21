import { afterEach, describe, expect, it, vi } from 'vitest'

describe('state', () => {
  afterEach(() => {
    vi.resetModules()
    vi.unstubAllGlobals()
  })

  it('normalizes legacy stored popup-window state', async () => {
    const browserMock = {
      storage: {
        local: {
          get: vi.fn().mockResolvedValue({
            'forkorfry:extension-state:v1': {
              armed: true,
              surfaceOpen: true,
              takeoverWindowId: 42,
              waitingForActivity: false,
              lastIdleAt: 1,
              lastTriggerAt: 2,
              lastOpenAt: 2,
              idleIntervalSeconds: 120,
            },
          }),
        },
      },
      runtime: {
        getURL: vi.fn((path: string) => `moz-extension://test/${path}`),
      },
    }

    vi.stubGlobal('browser', browserMock)

    const { getState } = await import('../src/core/state')

    await expect(getState()).resolves.toEqual({
      armed: true,
      surfaceOpen: true,
      activeSurface: 'popup-window',
      hostWindowId: 42,
      hostTabId: null,
      waitingForActivity: false,
      lastIdleAt: 1,
      lastTriggerAt: 2,
      lastOpenAt: 2,
      idleIntervalSeconds: 120,
    })
  })
})
