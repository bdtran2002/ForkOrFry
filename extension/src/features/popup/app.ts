import '../../style.css'
import { type BackgroundMessage } from '../../core/messages'
import { getState } from '../../core/state'
import { getRuntimeHostSession } from '../runtime-host/checkpoint-store'
import { DEFAULT_RUNTIME_DEFINITION } from '../runtime-host/runtime-definition'
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
    <div class="status-tile"><span class="status-label">${popupCopy.labels.pane}</span><strong class="status-value" id="pane-value"></strong></div>
    <div class="status-tile"><span class="status-label">${popupCopy.labels.awaitingActivity}</span><strong class="status-value" id="awaiting-activity-value"></strong></div>
    <div class="status-tile"><span class="status-label">${popupCopy.labels.lastTrigger}</span><strong class="status-value" id="last-trigger-value"></strong></div>
  </section>
  <div class="actions">
    <button type="button" class="primary" id="arm">${popupCopy.buttons.arm}</button>
    <button type="button" class="secondary" id="demo">${popupCopy.buttons.demo}</button>
    <button type="button" class="secondary" id="disarm">${popupCopy.buttons.disarm}</button>
    <button type="button" class="secondary" id="reset">${popupCopy.buttons.reset}</button>
  </div>
  <section class="checkpoint-card popup-runtime-card" aria-label="Runtime host details">
    <div class="log-title">${popupCopy.runtime.title}</div>
    <div class="checkpoint-grid">
      <div class="checkpoint-item"><span class="checkpoint-label">${popupCopy.runtime.statusLabel}</span><strong id="runtime-status-value"></strong></div>
      <div class="checkpoint-item"><span class="checkpoint-label">${popupCopy.runtime.resumeLabel}</span><strong id="runtime-resume-value"></strong></div>
      <div class="checkpoint-item"><span class="checkpoint-label">${popupCopy.runtime.checkpointLabel}</span><strong id="runtime-checkpoint-value"></strong></div>
    </div>
  </section>
  <p class="helper">${popupCopy.helper}</p>
</main>`

const status = app.querySelector<HTMLElement>('#status')!
const idleIntervalSelect = app.querySelector<HTMLSelectElement>('#idle-interval')!
const modeValue = app.querySelector<HTMLElement>('#mode-value')!
const paneValue = app.querySelector<HTMLElement>('#pane-value')!
const awaitingActivityValue = app.querySelector<HTMLElement>('#awaiting-activity-value')!
const lastTriggerValue = app.querySelector<HTMLElement>('#last-trigger-value')!
const runtimeStatusValue = app.querySelector<HTMLElement>('#runtime-status-value')!
const runtimeResumeValue = app.querySelector<HTMLElement>('#runtime-resume-value')!
const runtimeCheckpointValue = app.querySelector<HTMLElement>('#runtime-checkpoint-value')!
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

function hasStoredActivityState(state: Awaited<ReturnType<typeof getState>>) {
  return state.lastIdleAt !== null || state.lastTriggerAt !== null || state.surfaceOpen || state.waitingForActivity
}

async function refresh() {
  const [state, runtimeSession] = await Promise.all([
    getState(),
    getRuntimeHostSession(DEFAULT_RUNTIME_DEFINITION.id),
  ])
  const surfaceOpen = state.surfaceOpen
  const waitingForActivity = state.waitingForActivity

  idleIntervalSelect.value = String(state.idleIntervalSeconds)
  status.textContent = !state.armed
    ? popupCopy.status.disarmed
    : surfaceOpen
      ? popupCopy.status.surfaceOpen
      : waitingForActivity
        ? popupCopy.status.waitingForActivity
        : popupCopy.status.armedReady
  modeValue.textContent = state.armed ? popupCopy.armed : popupCopy.disarmed
  paneValue.textContent = surfaceOpen ? popupCopy.open : popupCopy.closed
  awaitingActivityValue.textContent = waitingForActivity ? popupCopy.yes : popupCopy.no
  lastTriggerValue.textContent = formatLastTrigger(state.lastTriggerAt)
  runtimeStatusValue.textContent = runtimeSession.lastOpenedAt
    ? runtimeSession.detail
      ? `${runtimeSession.status} — ${runtimeSession.detail}`
      : runtimeSession.status
    : popupCopy.runtime.unavailable
  runtimeResumeValue.textContent = String(runtimeSession.resumeCount)
  runtimeCheckpointValue.textContent = formatLastTrigger(runtimeSession.lastCheckpointAt)
  buttons.arm.disabled = state.armed
  buttons.disarm.disabled = !state.armed
  buttons.reset.disabled = !hasStoredActivityState(state) && !state.armed
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
