export const STORAGE_KEYS = {
  state: 'forkorfry:extension-state:v1',
} as const

export const IDLE_INTERVAL_SECONDS = 60
export const TAKEOVER_PAGE = 'takeover.html'

export type HostSurface = 'popup-window' | 'full-tab'

export interface ExtensionState {
  armed: boolean
  surfaceOpen: boolean
  activeSurface: HostSurface | null
  hostWindowId: number | null
  hostTabId: number | null
  waitingForActivity: boolean
  lastIdleAt: number | null
  lastTriggerAt: number | null
  lastOpenAt: number | null
  idleIntervalSeconds: number
}

interface LegacyExtensionStateV1 {
  armed?: boolean
  surfaceOpen?: boolean
  takeoverWindowId?: number | null
  waitingForActivity?: boolean
  lastIdleAt?: number | null
  lastTriggerAt?: number | null
  lastOpenAt?: number | null
  idleIntervalSeconds?: number
}

export const DEFAULT_STATE: ExtensionState = {
  armed: false,
  surfaceOpen: false,
  activeSurface: null,
  hostWindowId: null,
  hostTabId: null,
  waitingForActivity: false,
  lastIdleAt: null,
  lastTriggerAt: null,
  lastOpenAt: null,
  idleIntervalSeconds: IDLE_INTERVAL_SECONDS,
}

function isLegacyExtensionStateV1(value: unknown): value is LegacyExtensionStateV1 {
  return typeof value === 'object' && value !== null && 'takeoverWindowId' in value
}

function normalizeState(value: unknown): ExtensionState {
  if (!value || typeof value !== 'object') {
    return { ...DEFAULT_STATE }
  }

  if (isLegacyExtensionStateV1(value)) {
    const hostWindowId = typeof value.takeoverWindowId === 'number' ? value.takeoverWindowId : null

    return {
      armed: value.armed ?? DEFAULT_STATE.armed,
      surfaceOpen: value.surfaceOpen ?? DEFAULT_STATE.surfaceOpen,
      activeSurface: hostWindowId !== null ? 'popup-window' : null,
      hostWindowId,
      hostTabId: null,
      waitingForActivity: value.waitingForActivity ?? DEFAULT_STATE.waitingForActivity,
      lastIdleAt: value.lastIdleAt ?? DEFAULT_STATE.lastIdleAt,
      lastTriggerAt: value.lastTriggerAt ?? DEFAULT_STATE.lastTriggerAt,
      lastOpenAt: value.lastOpenAt ?? DEFAULT_STATE.lastOpenAt,
      idleIntervalSeconds: value.idleIntervalSeconds ?? DEFAULT_STATE.idleIntervalSeconds,
    }
  }

  return { ...DEFAULT_STATE, ...(value as Partial<ExtensionState>) }
}

export async function getState() {
  const stored = await browser.storage.local.get(STORAGE_KEYS.state)
  return normalizeState(stored[STORAGE_KEYS.state])
}

export async function setState(next: ExtensionState) {
  await browser.storage.local.set({ [STORAGE_KEYS.state]: next })
  return next
}

export async function resetState(state: ExtensionState) {
  await setState({ ...DEFAULT_STATE, idleIntervalSeconds: state.idleIntervalSeconds })
}

export function takeoverUrl(surface: HostSurface = 'popup-window') {
  const url = new URL(browser.runtime.getURL(TAKEOVER_PAGE))
  url.searchParams.set('surface', surface)
  return url.toString()
}
