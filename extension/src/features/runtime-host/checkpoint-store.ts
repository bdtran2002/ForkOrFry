import { type RuntimeCheckpointEnvelope } from './contract'

const STORAGE_KEY = 'forkorfry:runtime-host-session:v1'

export type RuntimeHostStatus = 'idle' | 'booting' | 'running' | 'paused' | 'ready' | 'error'
export type RuntimeHostLifecycleState = 'fresh' | 'hidden' | 'unloading' | 'reopened' | 'resumed'

export interface RuntimeHostSession {
  version: 1
  sessionId: string
  runtimeId: string
  status: RuntimeHostStatus
  detail: string | null
  lifecycleState: RuntimeHostLifecycleState
  resumeCount: number
  lastOpenedAt: number | null
  lastReadyAt: number | null
  lastCheckpointAt: number | null
  lastHiddenAt: number | null
  lastError: string | null
  checkpoint: RuntimeCheckpointEnvelope | null
}

export type MutableRuntimeHostSessionPatch = Partial<Pick<
  RuntimeHostSession,
  'status' | 'detail' | 'lifecycleState' | 'resumeCount' | 'lastOpenedAt' | 'lastReadyAt' | 'lastCheckpointAt' | 'lastHiddenAt' | 'lastError' | 'checkpoint'
>>

const DEFAULT_SESSION: RuntimeHostSession = {
  version: 1,
  sessionId: '',
  runtimeId: '',
  status: 'idle',
  detail: null,
  lifecycleState: 'fresh',
  resumeCount: 0,
  lastOpenedAt: null,
  lastReadyAt: null,
  lastCheckpointAt: null,
  lastHiddenAt: null,
  lastError: null,
  checkpoint: null,
}

function createSessionId() {
  return globalThis.crypto?.randomUUID?.() ?? `runtime-${Date.now()}`
}

function getScopedStorageKey(runtimeId: string) {
  return `${STORAGE_KEY}:${runtimeId}`
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isNullableNumber(value: unknown): value is number | null {
  return value === null || typeof value === 'number'
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string'
}

function isRuntimeHostStatus(value: unknown): value is RuntimeHostStatus {
  return ['idle', 'booting', 'running', 'paused', 'ready', 'error'].includes(String(value))
}

function isCheckpointEnvelope(value: unknown): value is RuntimeCheckpointEnvelope {
  return (
    isRecord(value) &&
    value.version === 1 &&
    typeof value.runtimeId === 'string' &&
    typeof value.updatedAt === 'number' &&
    'state' in value
  )
}

function isRuntimeHostSession(value: unknown): value is RuntimeHostSession {
  return (
    isRecord(value) &&
    value.version === 1 &&
    typeof value.sessionId === 'string' &&
    typeof value.runtimeId === 'string' &&
    isRuntimeHostStatus(value.status) &&
    isNullableString(value.detail) &&
    typeof value.lifecycleState === 'string' &&
    ['fresh', 'hidden', 'unloading', 'reopened', 'resumed'].includes(value.lifecycleState) &&
    typeof value.resumeCount === 'number' &&
    isNullableNumber(value.lastOpenedAt) &&
    isNullableNumber(value.lastReadyAt) &&
    isNullableNumber(value.lastCheckpointAt) &&
    isNullableNumber(value.lastHiddenAt) &&
    isNullableString(value.lastError) &&
    (value.checkpoint === null || isCheckpointEnvelope(value.checkpoint))
  )
}

function normalizeStoredSession(value: unknown, runtimeId: string) {
  if (!isRuntimeHostSession(value)) return null
  if (value.runtimeId && value.runtimeId !== runtimeId) return null

  return {
    ...DEFAULT_SESSION,
    ...value,
    runtimeId,
  } satisfies RuntimeHostSession
}

function withSessionId(session: RuntimeHostSession) {
  return session.sessionId ? session : { ...session, sessionId: createSessionId() }
}

export async function getRuntimeHostSession(runtimeId: string) {
  const scopedKey = getScopedStorageKey(runtimeId)
  const stored = await browser.storage.local.get(scopedKey)
  const scopedSession = normalizeStoredSession(stored[scopedKey], runtimeId)
  if (scopedSession) {
    return withSessionId(scopedSession)
  }

  if (stored[scopedKey] !== undefined) {
    console.warn(`Ignoring invalid runtime host session for ${scopedKey}.`)
  }

  const legacy = await browser.storage.local.get(STORAGE_KEY)
  const legacySession = normalizeStoredSession(legacy[STORAGE_KEY], runtimeId)
  if (legacySession) {
    const migrated = withSessionId(legacySession)
    await browser.storage.local.set({ [scopedKey]: migrated })
    await browser.storage.local.remove(STORAGE_KEY)
    return migrated
  }

  if (legacy[STORAGE_KEY] !== undefined) {
    console.warn('Ignoring invalid legacy runtime host session state.')
  }

  return withSessionId({ ...DEFAULT_SESSION, runtimeId })
}

export async function saveRuntimeHostSession(next: RuntimeHostSession) {
  await browser.storage.local.set({ [getScopedStorageKey(next.runtimeId)]: next })
  return next
}

export async function openRuntimeHostSession(runtimeId: string) {
  const current = await getRuntimeHostSession(runtimeId)
  const resumed = current.lastHiddenAt !== null || current.checkpoint !== null || current.lastOpenedAt !== null
  const next: RuntimeHostSession = {
    ...current,
    runtimeId,
    resumeCount: resumed ? current.resumeCount + 1 : current.resumeCount,
    lastOpenedAt: Date.now(),
    lastHiddenAt: null,
    lastError: null,
    lifecycleState: resumed ? 'reopened' : 'fresh',
  }

  await saveRuntimeHostSession(next)
  return next
}

export async function updateRuntimeHostSession(runtimeId: string, partial: MutableRuntimeHostSessionPatch) {
  const current = await getRuntimeHostSession(runtimeId)
  const next: RuntimeHostSession = {
    ...current,
    ...partial,
    version: current.version,
    sessionId: current.sessionId,
    runtimeId: current.runtimeId,
    lifecycleState: partial.lifecycleState ?? current.lifecycleState,
  }

  await saveRuntimeHostSession(next)
  return next
}

export async function saveRuntimeCheckpoint(runtimeId: string, checkpoint: RuntimeCheckpointEnvelope) {
  return updateRuntimeHostSession(runtimeId, {
    checkpoint,
    lastCheckpointAt: Date.now(),
    lastError: null,
  })
}

export async function resetRuntimeHostSession(runtimeId: string) {
  const next: RuntimeHostSession = {
    ...DEFAULT_SESSION,
    sessionId: createSessionId(),
    runtimeId,
  }

  await saveRuntimeHostSession(next)
  return next
}

export async function markRuntimeHostHidden(runtimeId: string, detail: string) {
  return updateRuntimeHostSession(runtimeId, {
    status: 'paused',
    detail,
    lifecycleState: 'hidden',
    lastHiddenAt: Date.now(),
  })
}

export async function markRuntimeHostUnloading(runtimeId: string, detail: string) {
  return updateRuntimeHostSession(runtimeId, {
    status: 'paused',
    detail,
    lifecycleState: 'unloading',
    lastHiddenAt: Date.now(),
  })
}

export async function clearRuntimeHostSession(runtimeId: string) {
  await browser.storage.local.remove([getScopedStorageKey(runtimeId), STORAGE_KEY])
}
