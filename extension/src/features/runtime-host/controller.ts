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
  flushForPageHide: (reason: string) => void
  getSession: () => RuntimeHostSession | null
}

export function createRuntimeHostController(options: RuntimeHostControllerOptions): RuntimeHostController {
  const targetOrigin = options.targetOrigin ?? window.location.origin
  let session: RuntimeHostSession | null = null
  let mount: RuntimeMount | null = null
  let disposed = false
  let messageQueue = Promise.resolve()

  const emit = (next: RuntimeHostSession) => {
    session = next
    options.onSessionChange(next)
  }

  const postToRuntime = (message: HostToRuntimeMessage) => {
    if (!mount) return
    mount.runtimeWindow.postMessage(message, targetOrigin)
  }

  const processRuntimeMessage = async (message: RuntimeToHostMessage) => {
    if (disposed) return

    try {
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
          if (message.checkpoint.runtimeId !== options.runtimeId) {
            console.warn('Ignoring checkpoint from the wrong runtime.', message.checkpoint.runtimeId)
            return
          }

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
    } catch (error) {
      console.error('Failed to process runtime message.', error)

      if (disposed) return

      const detail = error instanceof Error ? error.message : String(error)

      try {
        const next = await updateRuntimeHostSession(options.runtimeId, {
          status: 'error',
          detail: `Host message processing failed: ${detail}`,
          lastError: detail,
        })
        emit(next)
      } catch (persistError) {
        console.error('Failed to persist runtime host error state.', persistError)
      }
    }
  }

  const handleRuntimeMessage = (message: RuntimeToHostMessage) => {
    messageQueue = messageQueue.then(() => processRuntimeMessage(message), () => processRuntimeMessage(message))
  }

  const onWindowMessage = (event: MessageEvent<unknown>) => {
    if (!mount || event.source !== mount.runtimeWindow || event.origin !== targetOrigin) return
    if (!isRuntimeToHostMessage(event.data) || event.data.runtimeId !== options.runtimeId) return
    handleRuntimeMessage(event.data)
  }

  window.addEventListener('message', onWindowMessage)

  const boot = async (reset: boolean) => {
    if (reset) {
      if (mount) {
        const previousMount = mount
        mount = null

        try {
          previousMount.frame.src = 'about:blank'
        } catch {
          // Best effort only; the old runtime window is already detached from host message handling.
        }
      }

      await clearRuntimeHostSession(options.runtimeId)
    }

    const opened = await openRuntimeHostSession(options.runtimeId)
    const booting = await updateRuntimeHostSession(options.runtimeId, {
      status: 'booting',
      detail: 'Booting child runtime inside the extension host.',
    })
    emit(booting)

    try {
      mount = await options.mountRuntime({ reset })
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error)
      const failed = await updateRuntimeHostSession(options.runtimeId, {
        status: 'error',
        detail: `Boot failed: ${detail}`,
        lastError: detail,
      })
      emit(failed)
      throw error
    }

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
    flushForPageHide(reason: string) {
      if (disposed) return

      const hiddenAt = Date.now()

      if (session) {
        emit({
          ...session,
          status: 'paused',
          detail: reason,
          lastHiddenAt: hiddenAt,
        })
      }

      void markRuntimeHostHidden(options.runtimeId, reason)
        .then((next) => {
          emit(next)
        })
        .catch((error) => {
          console.error('Failed to persist runtime host pagehide state.', error)
        })

      postToRuntime({ type: 'host:pause', runtimeId: options.runtimeId, reason })
      postToRuntime({ type: 'host:shutdown', runtimeId: options.runtimeId })
    },
    getSession() {
      return session
    },
  }
}
