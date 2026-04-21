// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { BackgroundMessage } from '../src/core/messages'

type BrowserMock = {
  runtime: { sendMessage: ReturnType<typeof vi.fn> }
}

const state = vi.hoisted(() => ({
  getState: vi.fn(),
}))

const runtimeHost = vi.hoisted(() => ({
  getRuntimeHostSession: vi.fn(),
}))

vi.mock('../src/core/state', () => state)
vi.mock('../src/features/runtime-host/checkpoint-store', () => runtimeHost)

describe('popup app', () => {
  beforeEach(() => {
    vi.resetModules()
    document.body.innerHTML = '<div id="app"></div>'
    state.getState.mockReset()
    runtimeHost.getRuntimeHostSession.mockReset()
    Object.assign(globalThis, { browser: { runtime: { sendMessage: vi.fn() } } as BrowserMock })
  })

  it('renders state and sends popup commands', async () => {
    state.getState.mockResolvedValue({ armed: false, surfaceOpen: false, waitingForActivity: false, lastIdleAt: null, lastTriggerAt: null, lastOpenAt: null, takeoverWindowId: null, idleIntervalSeconds: 300 })
    runtimeHost.getRuntimeHostSession.mockResolvedValue({ runtimeId: 'burger-runtime', status: 'idle', detail: null, resumeCount: 0, lastOpenedAt: null, lastCheckpointAt: null })

    await import('../src/features/popup/app')
    await Promise.resolve()

    expect(runtimeHost.getRuntimeHostSession).toHaveBeenCalledWith('burger-runtime')
    expect(document.querySelector('#mode-value')?.textContent).toBe('Paused')
    expect(document.querySelector('#pane-value')?.textContent).toBe('Closed')
    expect(document.querySelector('#awaiting-activity-value')?.textContent).toBe('No')
    expect(document.querySelector('#status')?.textContent).toContain('Idle triggers are paused')
    expect(document.querySelector('#runtime-status-value')?.textContent).toBe('No host session yet')
    expect(document.querySelector<HTMLButtonElement>('#reset')?.disabled).toBe(true)

    const arm = document.querySelector<HTMLButtonElement>('#arm')!
    arm.click()
    expect(browser.runtime.sendMessage).toHaveBeenCalledWith({ type: 'arm' } satisfies BackgroundMessage)

    const select = document.querySelector<HTMLSelectElement>('#idle-interval')!
    select.value = '120'
    select.dispatchEvent(new Event('change'))
    expect(browser.runtime.sendMessage).toHaveBeenCalledWith({ type: 'set-idle-interval', idleIntervalSeconds: 120 } satisfies BackgroundMessage)
  })

  it('updates controls for armed state and reset/disarm actions', async () => {
    state.getState.mockResolvedValue({ armed: true, surfaceOpen: true, waitingForActivity: false, lastIdleAt: 1710000000000, lastTriggerAt: 1710000000000, lastOpenAt: 1710000000000, takeoverWindowId: 11, idleIntervalSeconds: 60 })
    runtimeHost.getRuntimeHostSession.mockResolvedValue({ runtimeId: 'burger-runtime', status: 'ready', detail: 'Ready: checkpoint, pause, resume, local-session', resumeCount: 2, lastOpenedAt: 1710000000000, lastCheckpointAt: 1710000000000 })

    await import('../src/features/popup/app')
    await Promise.resolve()

    expect(runtimeHost.getRuntimeHostSession).toHaveBeenCalledWith('burger-runtime')
    expect(document.querySelector('#status')?.textContent).toContain('local game pane is open')
    expect(document.querySelector('#last-trigger-value')?.textContent).not.toBe('Not yet')
    expect(document.querySelector<HTMLButtonElement>('#disarm')?.disabled).toBe(false)
    expect(document.querySelector('#pane-value')?.textContent).toBe('Open')
    expect(document.querySelector('#awaiting-activity-value')?.textContent).toBe('No')
    expect(document.querySelector('#runtime-status-value')?.textContent).toContain('ready')
    expect(document.querySelector('#runtime-resume-value')?.textContent).toBe('2')

    document.querySelector<HTMLButtonElement>('#reset')!.click()
    expect(browser.runtime.sendMessage).toHaveBeenCalledWith({ type: 'reset' } satisfies BackgroundMessage)
  })

  it('enables reset when only the runtime host has a stored checkpoint', async () => {
    state.getState.mockResolvedValue({ armed: false, surfaceOpen: false, waitingForActivity: false, lastIdleAt: null, lastTriggerAt: null, lastOpenAt: null, takeoverWindowId: null, idleIntervalSeconds: 60 })
    runtimeHost.getRuntimeHostSession.mockResolvedValue({ runtimeId: 'burger-runtime', status: 'paused', detail: 'Host window hidden.', resumeCount: 0, lastOpenedAt: 1710000000000, lastCheckpointAt: 1710000000000, checkpoint: { version: 1, runtimeId: 'burger-runtime', updatedAt: 1710000000000, state: { tick: 3 } } })

    await import('../src/features/popup/app')
    await Promise.resolve()

    expect(runtimeHost.getRuntimeHostSession).toHaveBeenCalledWith('burger-runtime')
    expect(document.querySelector('#runtime-checkpoint-value')?.textContent).not.toBe('Not yet')
    expect(document.querySelector<HTMLButtonElement>('#reset')?.disabled).toBe(false)
  })
})
