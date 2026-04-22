import { setState, takeoverUrl, type ExtensionState, type HostSurface } from './state'

const SHELL_WINDOW_SIZE = {
  width: 1100,
  height: 820,
} as const

interface SurfaceMountResult {
  hostWindowId: number | null
  hostTabId: number | null
}

export async function triggerTakeover(state: ExtensionState) {
  const now = Date.now()
  const surface = state.activeSurface ?? 'popup-window'
  const mounted = await openTakeoverSurface(surface, state)

  await setState({
    ...state,
    waitingForActivity: false,
    surfaceOpen: true,
    activeSurface: surface,
    hostWindowId: mounted.hostWindowId,
    hostTabId: mounted.hostTabId,
    lastTriggerAt: now,
    lastOpenAt: now,
  })
}

export async function openTakeoverInFullTab(state: ExtensionState) {
  const now = Date.now()
  const mounted = await openTakeoverSurface('full-tab', state)

  await setState({
    ...state,
    surfaceOpen: true,
    activeSurface: 'full-tab',
    hostWindowId: mounted.hostWindowId,
    hostTabId: mounted.hostTabId,
    lastTriggerAt: now,
    lastOpenAt: now,
  })
}

export async function armForActivity(state: ExtensionState) {
  await setState({ ...state, waitingForActivity: true, lastIdleAt: Date.now() })
}

async function openTakeoverSurface(surface: HostSurface, state: ExtensionState): Promise<SurfaceMountResult> {
  if (surface === 'full-tab') {
    const hostTabId = await openTakeoverTab(state.hostTabId)
    return { hostWindowId: null, hostTabId }
  }

  const hostWindowId = await openTakeoverWindow(state.hostWindowId)
  return { hostWindowId, hostTabId: null }
}

async function openTakeoverWindow(existingWindowId: number | null) {
  const url = takeoverUrl('popup-window')
  if (existingWindowId !== null) {
    try {
      await browser.windows.update(existingWindowId, { focused: true, ...SHELL_WINDOW_SIZE })
      return existingWindowId
    } catch {
      // recreate below
    }
  }

  const tabs = await browser.tabs.query({ url })
  const existing = tabs[0]

  if (existing?.windowId !== undefined) {
    await browser.windows.update(existing.windowId, { focused: true, ...SHELL_WINDOW_SIZE })
    return existing.windowId
  }

  const window = await browser.windows.create({
    url,
    focused: true,
    type: 'popup',
    ...SHELL_WINDOW_SIZE,
  })
  return window.id ?? null
}

async function openTakeoverTab(existingTabId: number | null) {
  if (existingTabId !== null) {
    try {
      const tab = await browser.tabs.update(existingTabId, { active: true })
      if (tab.windowId !== undefined) {
        await browser.windows.update(tab.windowId, { focused: true })
      }
      return tab.id ?? existingTabId
    } catch {
      // recreate below
    }
  }

  const url = takeoverUrl('full-tab')
  const tabs = await browser.tabs.query({ url })
  const existing = tabs[0]

  if (existing?.id !== undefined) {
    await browser.tabs.update(existing.id, { active: true })
    if (existing.windowId !== undefined) {
      await browser.windows.update(existing.windowId, { focused: true })
    }
    return existing.id
  }

  const tab = await browser.tabs.create({
    url,
    active: true,
  })

  if (tab.windowId !== undefined) {
    await browser.windows.update(tab.windowId, { focused: true })
  }

  return tab.id ?? null
}
