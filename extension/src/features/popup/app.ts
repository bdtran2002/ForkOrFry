import '../../style.css'
import { type BackgroundMessage } from '../../core/messages'
import { getState } from '../../core/state'
import { popupCopy } from './copy'

const app = document.querySelector<HTMLDivElement>('#app')
if (!app) throw new Error('Missing popup root')

app.innerHTML = `
<main class="popup">
  <p class="eyebrow">ForkOrFry</p>
  <h1>${popupCopy.title}</h1>
  <p class="lede">${popupCopy.lede}</p>
  <div class="interval-row">
    <label class="interval-label" for="idle-interval">${popupCopy.intervalLabel}</label>
    <select id="idle-interval" class="interval-select" aria-label="Idle interval">
      ${popupCopy.intervalOptions.map((option) => `<option value="${option.value}">${option.label}</option>`).join('')}
    </select>
  </div>
  <div class="status" id="status"></div>
  <section class="status-grid" aria-label="Extension status details">
    <div class="status-tile"><span class="status-label">${popupCopy.labels.mode}</span><strong class="status-value" id="mode-value"></strong></div>
    <div class="status-tile"><span class="status-label">${popupCopy.labels.takeoverTab}</span><strong class="status-value" id="tab-value"></strong></div>
    <div class="status-tile"><span class="status-label">${popupCopy.labels.lastTrigger}</span><strong class="status-value" id="last-trigger-value"></strong></div>
  </section>
  <div class="actions">
    <button type="button" class="primary" id="arm">${popupCopy.buttons.arm}</button>
    <button type="button" class="secondary" id="demo">${popupCopy.buttons.demo}</button>
    <button type="button" class="secondary" id="disarm">${popupCopy.buttons.disarm}</button>
    <button type="button" class="secondary" id="reset">${popupCopy.buttons.reset}</button>
  </div>
  <p class="helper">${popupCopy.helper}</p>
</main>`

const status = app.querySelector<HTMLElement>('#status')!
const idleIntervalSelect = app.querySelector<HTMLSelectElement>('#idle-interval')!
const modeValue = app.querySelector<HTMLElement>('#mode-value')!
const tabValue = app.querySelector<HTMLElement>('#tab-value')!
const lastTriggerValue = app.querySelector<HTMLElement>('#last-trigger-value')!
const buttons = {
  arm: app.querySelector<HTMLButtonElement>('#arm')!,
  demo: app.querySelector<HTMLButtonElement>('#demo')!,
  disarm: app.querySelector<HTMLButtonElement>('#disarm')!,
  reset: app.querySelector<HTMLButtonElement>('#reset')!,
}

function formatLastTrigger(lastIdleAt: number | null) {
  if (!lastIdleAt) return popupCopy.notYet

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(lastIdleAt))
}

async function refresh() {
  const state = await getState()
  const takeoverOpen = state.takeoverTabId !== null

  idleIntervalSelect.value = String(state.idleIntervalSeconds)
  status.textContent = state.armed
    ? takeoverOpen
      ? popupCopy.status.armedOpen
      : popupCopy.status.armedClosed
    : popupCopy.status.disarmed
  modeValue.textContent = state.armed ? popupCopy.armed : popupCopy.disarmed
  tabValue.textContent = takeoverOpen ? popupCopy.open : popupCopy.closed
  lastTriggerValue.textContent = formatLastTrigger(state.lastIdleAt)
  buttons.arm.disabled = state.armed
  buttons.disarm.disabled = !state.armed
  buttons.reset.disabled = !state.armed && !takeoverOpen && state.lastIdleAt === null
}

idleIntervalSelect.addEventListener('change', async () => {
  const message: BackgroundMessage = {
    type: 'set-idle-interval',
    idleIntervalSeconds: Number(idleIntervalSelect.value),
  }

  await browser.runtime.sendMessage(message)
  await refresh()
})

buttons.arm.addEventListener('click', async () => {
  await browser.runtime.sendMessage({ type: 'arm' } satisfies BackgroundMessage)
  await refresh()
})

buttons.demo.addEventListener('click', async () => {
  await browser.runtime.sendMessage({ type: 'demo-now' } satisfies BackgroundMessage)
  await refresh()
})

buttons.disarm.addEventListener('click', async () => {
  await browser.runtime.sendMessage({ type: 'disarm' } satisfies BackgroundMessage)
  await refresh()
})

buttons.reset.addEventListener('click', async () => {
  await browser.runtime.sendMessage({ type: 'reset' } satisfies BackgroundMessage)
  await refresh()
})

void refresh()
