export const STORAGE_KEYS = {
  state: 'forkorfry:extension-state:v1',
} as const

export const IDLE_INTERVAL_SECONDS = 60
export const TAKEOVER_PAGE = 'takeover.html'

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

export function takeoverUrl() {
  return browser.runtime.getURL(TAKEOVER_PAGE)
}
