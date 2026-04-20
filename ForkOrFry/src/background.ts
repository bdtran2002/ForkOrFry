import { DEFAULT_STATE, IDLE_INTERVAL_SECONDS, getState, setState, takeoverUrl } from './shared'

let stateQueue = Promise.resolve()

function serializeStateTask(task: () => Promise<void>) {
  const next = stateQueue.then(task, task)
  stateQueue = next.catch(() => undefined)
  return next
}

async function ensureTakeoverTab() {
  const url = takeoverUrl()
  const tabs = await browser.tabs.query({ url })
  const existing = tabs[0]

  if (existing?.id !== undefined) {
    await browser.tabs.update(existing.id, { active: true })
    if (existing.windowId !== undefined) await browser.windows.update(existing.windowId, { focused: true })
    return existing.id
  }

  const tab = await browser.tabs.create({ url, active: true })
  return tab.id ?? null
}

async function closeTakeoverTab(tabId: number | null) {
  if (tabId === null) return

  try {
    await browser.tabs.remove(tabId)
  } catch {
    // The user may have already closed the takeover tab.
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
  await closeTakeoverTab(state.takeoverTabId)
  await setState({ ...DEFAULT_STATE, idleIntervalSeconds: state.idleIntervalSeconds })
}

browser.runtime.onInstalled.addListener(async () => {
  const existing = await getState()
  await setState({ ...DEFAULT_STATE, ...existing })
})

browser.tabs.onRemoved.addListener((tabId) => {
  void serializeStateTask(async () => {
    const state = await getState()
    if (state.takeoverTabId !== tabId) return
    await setState({ ...state, takeoverTabId: null })
  })
})

browser.idle.onStateChanged.addListener((idleState) => {
  if (idleState !== 'idle') return

  void serializeStateTask(async () => {
    const state = await getState()
    if (!state.armed) return

    const takeoverTabId = await ensureTakeoverTab()
    await setState({ ...state, lastIdleAt: Date.now(), takeoverTabId })
  })
})

browser.runtime.onMessage.addListener(async (message) => {
  if (!message || typeof message !== 'object' || !('type' in message)) return

  if (message.type === 'arm') {
    return serializeStateTask(arm)
  }

  if (message.type === 'disarm') {
    return serializeStateTask(disarm)
  }

  if (message.type === 'reset') {
    return serializeStateTask(async () => {
      const state = await getState()
      await closeTakeoverTab(state.takeoverTabId)
      await setState({ ...DEFAULT_STATE, idleIntervalSeconds: state.idleIntervalSeconds })
    })
  }

  if (message.type === 'demo-now') {
    return serializeStateTask(async () => {
      const state = await getState()
      const takeoverTabId = await ensureTakeoverTab()
      await setState({ ...state, lastIdleAt: Date.now(), takeoverTabId })
    })
  }

  if (message.type === 'set-idle-interval' && typeof message.idleIntervalSeconds === 'number') {
    return serializeStateTask(() => updateIdleInterval(message.idleIntervalSeconds))
  }
})
