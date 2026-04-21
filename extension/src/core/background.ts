import { type BackgroundMessage } from './messages'
import { clearRuntimeHostSession } from '../features/runtime-host/checkpoint-store'
import { DEFAULT_STATE, IDLE_INTERVAL_SECONDS, getState, resetState, setState } from './state'
import { armForActivity, triggerTakeover } from './takeover'

let stateQueue = Promise.resolve()

function serializeStateTask(task: () => Promise<void>) {
  const next = stateQueue.then(task, task)
  stateQueue = next.catch(() => undefined)
  return next
}

async function closeTakeoverWindow(windowId: number | null) {
  if (windowId === null) return

  try {
    await browser.windows.remove(windowId)
  } catch {
    // The user may have already closed the takeover window.
  }
}

async function arm() {
  const state = await getState()
  browser.idle.setDetectionInterval(state.idleIntervalSeconds ?? IDLE_INTERVAL_SECONDS)
  await setState({ ...state, armed: true })
}

async function updateIdleInterval(idleIntervalSeconds: number) {
  const state = await getState()
  const nextState = { ...state, idleIntervalSeconds }
  if (state.armed) browser.idle.setDetectionInterval(idleIntervalSeconds)
  await setState(nextState)
}

async function disarm() {
  const state = await getState()
  await closeTakeoverWindow(state.takeoverWindowId)
  await resetState(state)
}

browser.runtime.onInstalled.addListener(async () => {
  const existing = await getState()
  await setState({ ...DEFAULT_STATE, ...existing })
})

browser.windows.onRemoved.addListener((windowId) => {
  void serializeStateTask(async () => {
    const state = await getState()
    if (state.takeoverWindowId !== windowId) return
    await setState({ ...state, surfaceOpen: false, takeoverWindowId: null })
  })
})

browser.idle.onStateChanged.addListener((idleState) => {
  void serializeStateTask(async () => {
    const state = await getState()
    if (!state.armed) return

    if (idleState === 'idle') {
      await armForActivity(state)
      return
    }

    if (idleState === 'active' && state.waitingForActivity) {
      await triggerTakeover(state)
    }
  })
})

browser.runtime.onMessage.addListener(async (message: BackgroundMessage) => {
  if (message.type === 'arm') {
    return serializeStateTask(arm)
  }

  if (message.type === 'disarm') {
    return serializeStateTask(disarm)
  }

  if (message.type === 'reset') {
    return serializeStateTask(async () => {
      const state = await getState()
      await closeTakeoverWindow(state.takeoverWindowId)
      await clearRuntimeHostSession()
      await resetState(state)
    })
  }

  if (message.type === 'demo-now') {
    return serializeStateTask(async () => {
      const state = await getState()
      await triggerTakeover(state)
    })
  }

  if (message.type === 'set-idle-interval' && typeof message.idleIntervalSeconds === 'number') {
    return serializeStateTask(() => updateIdleInterval(message.idleIntervalSeconds))
  }
})
