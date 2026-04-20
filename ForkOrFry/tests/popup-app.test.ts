// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'

type BrowserMock = {
  runtime: { sendMessage: ReturnType<typeof vi.fn> }
}

const shared = vi.hoisted(() => ({
  getState: vi.fn(),
}))

vi.mock('../src/shared', () => shared)

describe('popup app', () => {
  beforeEach(() => {
    vi.resetModules()
    document.body.innerHTML = '<div id="app"></div>'
    shared.getState.mockReset()
    Object.assign(globalThis, { browser: { runtime: { sendMessage: vi.fn() } } as BrowserMock })
  })

  it('renders state and sends popup commands', async () => {
    shared.getState.mockResolvedValue({ armed: false, takeoverTabId: null, lastIdleAt: null, idleIntervalSeconds: 300 })

    await import('../src/popup-app')
    await Promise.resolve()

    expect(document.querySelector('#mode-value')?.textContent).toBe('Disarmed')
    expect(document.querySelector('#tab-value')?.textContent).toBe('Closed')

    const arm = document.querySelector<HTMLButtonElement>('#arm')!
    arm.click()
    expect(browser.runtime.sendMessage).toHaveBeenCalledWith({ type: 'arm' })

    const select = document.querySelector<HTMLSelectElement>('#idle-interval')!
    select.value = '120'
    select.dispatchEvent(new Event('change'))
    expect(browser.runtime.sendMessage).toHaveBeenCalledWith({ type: 'set-idle-interval', idleIntervalSeconds: 120 })
  })

  it('updates controls for armed state and reset/disarm actions', async () => {
    shared.getState.mockResolvedValue({ armed: true, takeoverTabId: 11, lastIdleAt: 1710000000000, idleIntervalSeconds: 60 })

    await import('../src/popup-app')
    await Promise.resolve()

    expect(document.querySelector('#status')?.textContent).toContain('Armed')
    expect(document.querySelector('#last-trigger-value')?.textContent).not.toBe('Not yet')
    expect(document.querySelector<HTMLButtonElement>('#disarm')?.disabled).toBe(false)

    document.querySelector<HTMLButtonElement>('#reset')!.click()
    expect(browser.runtime.sendMessage).toHaveBeenCalledWith({ type: 'reset' })
  })
})
