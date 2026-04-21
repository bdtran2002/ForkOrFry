import { type RuntimeCheckpointEnvelope } from './contract'

const STORAGE_KEY = 'forkorfry:runtime-host-session:v1'

export type RuntimeHostStatus = 'idle' | 'booting' | 'running' | 'paused' | 'ready' | 'error'

export interface RuntimeHostSession {
  version: 1
  sessionId: string
  runtimeId: string
  status: RuntimeHostStatus
  detail: string | null
  resumeCount: number
  lastOpenedAt: number | null
  lastReadyAt: number | null
  lastCheckpointAt: number | null
  lastHiddenAt: number | null
  lastError: string | null
  checkpoint: RuntimeCheckpointEnvelope | null
}

const DEFAULT_SESSION: RuntimeHostSession = {
  version: 1,
  sessionId: '',
  runtimeId: '',
  status: 'idle',
  detail: null,
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

export async function getRuntimeHostSession(runtimeId: string) {
  const stored = await browser.storage.local.get(STORAGE_KEY)
  const merged = {
    ...DEFAULT_SESSION,
    ...(stored[STORAGE_KEY] as Partial<RuntimeHostSession> | undefined),
    runtimeId,
  }

  return merged.sessionId ? merged : { ...merged, sessionId: createSessionId() }
}

export async function saveRuntimeHostSession(next: RuntimeHostSession) {
  await browser.storage.local.set({ [STORAGE_KEY]: next })
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
  }

  await saveRuntimeHostSession(next)
  return next
}

export async function updateRuntimeHostSession(runtimeId: string, partial: Partial<RuntimeHostSession>) {
  const current = await getRuntimeHostSession(runtimeId)
  const next: RuntimeHostSession = {
    ...current,
    ...partial,
    runtimeId,
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

export async function markRuntimeHostHidden(runtimeId: string, detail: string) {
  return updateRuntimeHostSession(runtimeId, {
    status: 'paused',
    detail,
    lastHiddenAt: Date.now(),
  })
}

export async function clearRuntimeHostSession() {
  await browser.storage.local.remove(STORAGE_KEY)
}
