export const STORAGE_KEYS = {
  state: 'forkorfry:extension-state:v1',
} as const

export const IDLE_INTERVAL_SECONDS = 60
export const TAKEOVER_PAGE = 'takeover.html'

export interface ExtensionState {
  armed: boolean
  surfaceOpen: boolean
  takeoverWindowId: number | null
  waitingForActivity: boolean
  lastIdleAt: number | null
  lastTriggerAt: number | null
  lastOpenAt: number | null
  idleIntervalSeconds: number
}

export const DEFAULT_STATE: ExtensionState = {
  armed: false,
  surfaceOpen: false,
  takeoverWindowId: null,
  waitingForActivity: false,
  lastIdleAt: null,
  lastTriggerAt: null,
  lastOpenAt: null,
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

export function takeoverUrl() {
  return browser.runtime.getURL(TAKEOVER_PAGE)
}
