import { setState, takeoverUrl, type ExtensionState } from './state'

export async function triggerTakeover(state: ExtensionState) {
  const takeoverTabId = await openTakeoverTab()
  await setState({ ...state, lastIdleAt: Date.now(), takeoverTabId })
}

async function openTakeoverTab() {
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
