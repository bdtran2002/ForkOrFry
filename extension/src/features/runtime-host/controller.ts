import {
  type HostToRuntimeMessage,
  isRuntimeToHostMessage,
  type RuntimeToHostMessage,
} from './contract'
import {
  clearRuntimeHostSession,
  markRuntimeHostHidden,
  openRuntimeHostSession,
  saveRuntimeCheckpoint,
  type RuntimeHostSession,
  updateRuntimeHostSession,
} from './checkpoint-store'

export interface RuntimeMount {
  frame: HTMLIFrameElement
  runtimeWindow: Window
}

export interface RuntimeMountRequest {
  reset: boolean
}

interface RuntimeHostControllerOptions {
  runtimeId: string
  mountRuntime: (request: RuntimeMountRequest) => Promise<RuntimeMount>
  onSessionChange: (session: RuntimeHostSession) => void
  targetOrigin?: string
}

export interface RuntimeHostController {
  start: () => Promise<void>
  pause: (reason: string) => Promise<void>
  resume: () => Promise<void>
  reset: () => Promise<void>
  shutdown: () => Promise<void>
  getSession: () => RuntimeHostSession | null
}

export function createRuntimeHostController(options: RuntimeHostControllerOptions): RuntimeHostController {
  const targetOrigin = options.targetOrigin ?? window.location.origin
  let session: RuntimeHostSession | null = null
  let mount: RuntimeMount | null = null
  let disposed = false

  const emit = (next: RuntimeHostSession) => {
    session = next
    options.onSessionChange(next)
  }

  const postToRuntime = (message: HostToRuntimeMessage) => {
    if (!mount) return
    mount.runtimeWindow.postMessage(message, targetOrigin)
  }

  const handleRuntimeMessage = (message: RuntimeToHostMessage) => {
    void (async () => {
      if (disposed) return

      switch (message.type) {
        case 'runtime:ready': {
          const next = await updateRuntimeHostSession(options.runtimeId, {
            status: 'ready',
            detail: `Ready: ${message.capabilities.join(', ')}`,
            lastReadyAt: Date.now(),
            lastError: null,
          })
          emit(next)
          return
        }
        case 'runtime:status': {
          const next = await updateRuntimeHostSession(options.runtimeId, {
            status: message.phase,
            detail: message.detail,
          })
          emit(next)
          return
        }
        case 'runtime:checkpoint': {
          const next = await saveRuntimeCheckpoint(options.runtimeId, message.checkpoint)
          emit(next)
          return
        }
        case 'runtime:fatal': {
          const next = await updateRuntimeHostSession(options.runtimeId, {
            status: 'error',
            detail: message.message,
            lastError: message.message,
          })
          emit(next)
        }
      }
    })()
  }

  const onWindowMessage = (event: MessageEvent<unknown>) => {
    if (!mount || event.source !== mount.runtimeWindow || event.origin !== targetOrigin) return
    if (!isRuntimeToHostMessage(event.data) || event.data.runtimeId !== options.runtimeId) return
    handleRuntimeMessage(event.data)
  }

  window.addEventListener('message', onWindowMessage)

  const boot = async (reset: boolean) => {
    if (reset) {
      await clearRuntimeHostSession()
    }

    const opened = await openRuntimeHostSession(options.runtimeId)
    const booting = await updateRuntimeHostSession(options.runtimeId, {
      status: 'booting',
      detail: 'Booting child runtime inside the extension host.',
    })

    mount = await options.mountRuntime({ reset })
    emit(booting)

    postToRuntime({
      type: 'host:boot',
      runtimeId: options.runtimeId,
      sessionId: opened.sessionId,
      checkpoint: opened.checkpoint,
    })
  }

  return {
    async start() {
      await boot(false)
    },
    async pause(reason: string) {
      const next = await markRuntimeHostHidden(options.runtimeId, reason)
      emit(next)
      postToRuntime({ type: 'host:pause', runtimeId: options.runtimeId, reason })
    },
    async resume() {
      const next = await updateRuntimeHostSession(options.runtimeId, {
        status: 'running',
        detail: 'Resuming child runtime from the latest checkpoint.',
        lastHiddenAt: null,
      })
      emit(next)
      postToRuntime({ type: 'host:resume', runtimeId: options.runtimeId, checkpoint: next.checkpoint })
    },
    async reset() {
      await boot(true)
    },
    async shutdown() {
      if (disposed) return
      disposed = true
      postToRuntime({ type: 'host:shutdown', runtimeId: options.runtimeId })
      window.removeEventListener('message', onWindowMessage)
    },
    getSession() {
      return session
    },
  }
}
