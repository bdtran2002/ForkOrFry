export const STORAGE_KEYS = {
  state: 'forkorfry:extension-state:v1',
} as const

export const IDLE_INTERVAL_SECONDS = 60
export const TAKEOVER_PAGE = 'takeover.html'

export type BackgroundMessage =
  | { type: 'arm' }
  | { type: 'disarm' }
  | { type: 'reset' }
  | { type: 'demo-now' }
  | { type: 'set-idle-interval'; idleIntervalSeconds: number }

export interface ExtensionState {
  armed: boolean
  takeoverTabId: number | null
  lastIdleAt: number | null
  idleIntervalSeconds: number
}

export const DEFAULT_STATE: ExtensionState = {
  armed: false,
  takeoverTabId: null,
  lastIdleAt: null,
  idleIntervalSeconds: IDLE_INTERVAL_SECONDS,
}

export async function getState() {
  const stored = await browser.storage.local.get(STORAGE_KEYS.state)
  return { ...DEFAULT_STATE, ...(stored[STORAGE_KEYS.state] as Partial<ExtensionState> | undefined) }
}

export async function setState(next: ExtensionState) {
  await browser.storage.local.set({ [STORAGE_KEYS.state]: next })
  return next
}

export async function resetState(state: ExtensionState) {
  await setState({ ...DEFAULT_STATE, idleIntervalSeconds: state.idleIntervalSeconds })
}

export async function triggerTakeover(state: ExtensionState) {
  const takeoverTabId = await openTakeoverTab()
  await setState({ ...state, lastIdleAt: Date.now(), takeoverTabId })
}

async function openTakeoverTab() {
  const url = takeoverUrl()
  const tabs = await browser.tabs.query({ url })
  const existing = tabs[0]

  if (existing?.id !== undefined) {
    await browser.tabs.update(existing.id, { active: true })
    if (existing.windowId !== undefined) await browser.windows.update(existing.windowId, { focused: true })
    return existing.id
  }

  const tab = await browser.tabs.create({ url, active: true })
  return tab.id ?? null
}

export function takeoverUrl() {
  return browser.runtime.getURL(TAKEOVER_PAGE)
}
