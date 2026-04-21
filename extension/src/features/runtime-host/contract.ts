export const RUNTIME_PROTOCOL_VERSION = 1 as const

export interface RuntimeCheckpointEnvelope<TState = unknown> {
  version: typeof RUNTIME_PROTOCOL_VERSION
  runtimeId: string
  updatedAt: number
  state: TState
}

export type HostToRuntimeMessage =
  | {
      type: 'host:boot'
      runtimeId: string
      sessionId: string
      checkpoint: RuntimeCheckpointEnvelope | null
    }
  | {
      type: 'host:pause'
      runtimeId: string
      reason: string
    }
  | {
      type: 'host:resume'
      runtimeId: string
      checkpoint: RuntimeCheckpointEnvelope | null
    }
  | {
      type: 'host:shutdown'
      runtimeId: string
    }

export type RuntimeStatusPhase = 'booting' | 'running' | 'paused' | 'ready'

export type RuntimeToHostMessage =
  | {
      type: 'runtime:ready'
      runtimeId: string
      capabilities: string[]
    }
  | {
      type: 'runtime:status'
      runtimeId: string
      phase: RuntimeStatusPhase
      detail: string
    }
  | {
      type: 'runtime:checkpoint'
      runtimeId: string
      checkpoint: RuntimeCheckpointEnvelope
    }
  | {
      type: 'runtime:fatal'
      runtimeId: string
      message: string
    }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isCheckpointEnvelope(value: unknown): value is RuntimeCheckpointEnvelope {
  return (
    isRecord(value) &&
    value.version === RUNTIME_PROTOCOL_VERSION &&
    typeof value.runtimeId === 'string' &&
    typeof value.updatedAt === 'number' &&
    'state' in value
  )
}

export function isHostToRuntimeMessage(value: unknown): value is HostToRuntimeMessage {
  if (!isRecord(value) || typeof value.type !== 'string') return false

  switch (value.type) {
    case 'host:boot':
      return (
        typeof value.runtimeId === 'string' &&
        typeof value.sessionId === 'string' &&
        (value.checkpoint === null || isCheckpointEnvelope(value.checkpoint))
      )
    case 'host:pause':
      return typeof value.runtimeId === 'string' && typeof value.reason === 'string'
    case 'host:resume':
      return typeof value.runtimeId === 'string' && (value.checkpoint === null || isCheckpointEnvelope(value.checkpoint))
    case 'host:shutdown':
      return typeof value.runtimeId === 'string'
    default:
      return false
  }
}

export function isRuntimeToHostMessage(value: unknown): value is RuntimeToHostMessage {
  if (!isRecord(value) || typeof value.type !== 'string' || typeof value.runtimeId !== 'string') {
    return false
  }

  switch (value.type) {
    case 'runtime:ready':
      return Array.isArray(value.capabilities) && value.capabilities.every((entry) => typeof entry === 'string')
    case 'runtime:status':
      return typeof value.phase === 'string' && typeof value.detail === 'string'
    case 'runtime:checkpoint':
      return isCheckpointEnvelope(value.checkpoint)
    case 'runtime:fatal':
      return typeof value.message === 'string'
    default:
      return false
  }
}
