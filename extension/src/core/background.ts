import { type BackgroundMessage } from './messages'
import { clearRuntimeHostSession } from '../features/runtime-host/checkpoint-store'
import { DEFAULT_RUNTIME_DEFINITION } from '../features/runtime-host/runtime-definition'
import { DEFAULT_STATE, IDLE_INTERVAL_SECONDS, getState, resetState, setState, type ExtensionState } from './state'
import { armForActivity, openTakeoverInFullTab, triggerTakeover } from './takeover'

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

async function closeTakeoverTab(tabId: number | null) {
  if (tabId === null) return

  try {
    await browser.tabs.remove(tabId)
  } catch {
    // The user may have already closed the takeover tab.
  }
}

function clearOpenSurfaceState(state: ExtensionState): ExtensionState {
  return {
    ...state,
    surfaceOpen: false,
    activeSurface: null,
    hostWindowId: null,
    hostTabId: null,
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
  await closeTakeoverWindow(state.hostWindowId)
  await closeTakeoverTab(state.hostTabId)
  await resetState(state)
}

browser.runtime.onInstalled.addListener(async () => {
  const existing = await getState()
  await setState({ ...DEFAULT_STATE, ...existing })
})

browser.windows.onRemoved.addListener((windowId) => {
  void serializeStateTask(async () => {
    const state = await getState()
    if (state.hostWindowId !== windowId) return
    await setState(clearOpenSurfaceState(state))
  })
})

browser.tabs.onRemoved.addListener((tabId) => {
  void serializeStateTask(async () => {
    const state = await getState()
    if (state.hostTabId !== tabId) return
    await setState(clearOpenSurfaceState(state))
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
      await closeTakeoverWindow(state.hostWindowId)
      await closeTakeoverTab(state.hostTabId)
      try {
        await clearRuntimeHostSession(DEFAULT_RUNTIME_DEFINITION.id)
      } catch (error) {
        console.warn('Failed to clear runtime host session during reset.', error)
      }
      await resetState(state)
    })
  }

  if (message.type === 'demo-now') {
    return serializeStateTask(async () => {
      const state = await getState()
      await triggerTakeover(state)
    })
  }

  if (message.type === 'close-surface') {
    return serializeStateTask(async () => {
      const state = await getState()
      await closeTakeoverWindow(state.hostWindowId)
      await closeTakeoverTab(state.hostTabId)
      await setState(clearOpenSurfaceState(state))
    })
  }

  if (message.type === 'open-full-tab') {
    return serializeStateTask(async () => {
      const state = await getState()
      if (state.surfaceOpen && state.activeSurface === 'popup-window') return
      await openTakeoverInFullTab(state)
    })
  }

  if (message.type === 'move-to-full-tab') {
    return serializeStateTask(async () => {
      const state = await getState()
      await openTakeoverInFullTab(state)
    })
  }

  if (message.type === 'set-idle-interval' && typeof message.idleIntervalSeconds === 'number') {
    return serializeStateTask(() => updateIdleInterval(message.idleIntervalSeconds))
  }
})
