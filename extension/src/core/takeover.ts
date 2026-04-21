import { setState, takeoverUrl, type ExtensionState } from './state'

export async function triggerTakeover(state: ExtensionState) {
  const now = Date.now()
  const takeoverWindowId = await openTakeoverWindow(state.takeoverWindowId)
  await setState({
    ...state,
    waitingForActivity: false,
    surfaceOpen: true,
    takeoverWindowId,
    lastTriggerAt: now,
    lastOpenAt: now,
  })
}

export async function armForActivity(state: ExtensionState) {
  await setState({ ...state, waitingForActivity: true, lastIdleAt: Date.now() })
}

async function openTakeoverWindow(existingWindowId: number | null) {
  const url = takeoverUrl()
  if (existingWindowId !== null) {
    try {
      await browser.windows.update(existingWindowId, { focused: true })
      return existingWindowId
    } catch {
      // recreate below
    }
  }

  const tabs = await browser.tabs.query({ url })
  const existing = tabs[0]

  if (existing?.windowId !== undefined) {
    await browser.windows.update(existing.windowId, { focused: true })
    return existing.windowId
  }

  const window = await browser.windows.create({ url, focused: true, type: 'popup' })
  return window.id ?? null
}
