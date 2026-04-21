const SESSION_STORAGE_KEY = 'forkorfry:game-shell-session:v1'

export interface GameShellSession {
  sessionId: string
  currentStep: number
  completed: boolean
  logs: string[]
  resumeCount: number
  lastOpenedAt: number | null
  lastCheckpointAt: number | null
  lastHiddenAt: number | null
}

const DEFAULT_SESSION: GameShellSession = {
  sessionId: '',
  currentStep: 0,
  completed: false,
  logs: [],
  resumeCount: 0,
  lastOpenedAt: null,
  lastCheckpointAt: null,
  lastHiddenAt: null,
}

function createSessionId() {
  return globalThis.crypto?.randomUUID?.() ?? `shell-${Date.now()}`
}

export async function getGameShellSession() {
  const stored = await browser.storage.local.get(SESSION_STORAGE_KEY)
  const merged = {
    ...DEFAULT_SESSION,
    ...(stored[SESSION_STORAGE_KEY] as Partial<GameShellSession> | undefined),
  }

  return merged.sessionId ? merged : { ...merged, sessionId: createSessionId() }
}

export async function saveGameShellSession(next: GameShellSession) {
  await browser.storage.local.set({ [SESSION_STORAGE_KEY]: next })
  return next
}

export async function openGameShellSession() {
  const current = await getGameShellSession()
  const resumed = current.lastHiddenAt !== null || current.currentStep > 0 || current.completed
  const next: GameShellSession = {
    ...current,
    resumeCount: resumed ? current.resumeCount + 1 : current.resumeCount,
    lastOpenedAt: Date.now(),
    lastHiddenAt: null,
  }

  await saveGameShellSession(next)
  return next
}

export async function checkpointGameShellSession(partial: Partial<GameShellSession>) {
  const current = await getGameShellSession()
  const next: GameShellSession = {
    ...current,
    ...partial,
    lastCheckpointAt: Date.now(),
  }

  await saveGameShellSession(next)
  return next
}

export async function clearGameShellSession() {
  await browser.storage.local.remove(SESSION_STORAGE_KEY)
}
