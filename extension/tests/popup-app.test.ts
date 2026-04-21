// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { BackgroundMessage } from '../src/core/messages'

type BrowserMock = {
  runtime: { sendMessage: ReturnType<typeof vi.fn> }
}

const state = vi.hoisted(() => ({
  getState: vi.fn(),
}))

vi.mock('../src/core/state', () => state)

describe('popup app', () => {
  beforeEach(() => {
    vi.resetModules()
    document.body.innerHTML = '<div id="app"></div>'
    state.getState.mockReset()
    Object.assign(globalThis, { browser: { runtime: { sendMessage: vi.fn() } } as BrowserMock })
  })

  it('renders state and sends popup commands', async () => {
    state.getState.mockResolvedValue({ armed: false, surfaceOpen: false, waitingForActivity: false, lastIdleAt: null, lastTriggerAt: null, lastOpenAt: null, takeoverWindowId: null, idleIntervalSeconds: 300 })

    await import('../src/features/popup/app')
    await Promise.resolve()

    expect(document.querySelector('#mode-value')?.textContent).toBe('Paused')
    expect(document.querySelector('#pane-value')?.textContent).toBe('Closed')
    expect(document.querySelector('#awaiting-activity-value')?.textContent).toBe('No')
    expect(document.querySelector('#status')?.textContent).toContain('Idle triggers are paused')

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

    await import('../src/features/popup/app')
    await Promise.resolve()

    expect(document.querySelector('#status')?.textContent).toContain('local game pane is open')
    expect(document.querySelector('#last-trigger-value')?.textContent).not.toBe('Not yet')
    expect(document.querySelector<HTMLButtonElement>('#disarm')?.disabled).toBe(false)
    expect(document.querySelector('#pane-value')?.textContent).toBe('Open')
    expect(document.querySelector('#awaiting-activity-value')?.textContent).toBe('No')

    document.querySelector<HTMLButtonElement>('#reset')!.click()
    expect(browser.runtime.sendMessage).toHaveBeenCalledWith({ type: 'reset' } satisfies BackgroundMessage)
  })
})
