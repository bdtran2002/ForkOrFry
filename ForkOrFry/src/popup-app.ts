import './style.css'
import { getState } from './shared'

const app = document.querySelector<HTMLDivElement>('#app')
if (!app) throw new Error('Missing popup root')

app.innerHTML = `
<main class="popup">
  <p class="eyebrow">ForkOrFry</p>
  <h1>Arm the fryer</h1>
  <p class="lede">Firefox-only local parody. Idle detection opens a takeover tab; nothing is injected, submitted, or sent anywhere.</p>
  <div class="interval-row">
    <label class="interval-label" for="idle-interval">Idle interval</label>
    <select id="idle-interval" class="interval-select" aria-label="Idle interval">
      <option value="60">1 min</option>
      <option value="120">2 min</option>
      <option value="300">5 min</option>
      <option value="600">10 min</option>
    </select>
  </div>
  <div class="status" id="status"></div>
  <section class="status-grid" aria-label="Extension status details">
    <div class="status-tile">
      <span class="status-label">Mode</span>
      <strong class="status-value" id="mode-value"></strong>
    </div>
    <div class="status-tile">
      <span class="status-label">Takeover tab</span>
      <strong class="status-value" id="tab-value"></strong>
    </div>
    <div class="status-tile">
      <span class="status-label">Last trigger</span>
      <strong class="status-value" id="last-trigger-value"></strong>
    </div>
  </section>
  <div class="actions">
    <button type="button" class="primary" id="arm">Arm</button>
    <button type="button" class="secondary" id="demo">Demo now</button>
    <button type="button" class="secondary" id="disarm">Disarm</button>
    <button type="button" class="secondary" id="reset">Clear state</button>
  </div>
  <p class="helper">Clear state removes the stored idle timestamp and closes any open takeover tab.</p>
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
  if (!lastIdleAt) return 'Not yet'
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
      ? 'Armed. The takeover tab is already open.'
      : 'Armed. Firefox idle will open the takeover tab.'
    : 'Disarmed. The prank is paused until you arm it.'
  modeValue.textContent = state.armed ? 'Armed' : 'Disarmed'
  tabValue.textContent = takeoverOpen ? 'Open' : 'Closed'
  lastTriggerValue.textContent = formatLastTrigger(state.lastIdleAt)
  buttons.arm.disabled = state.armed
  buttons.disarm.disabled = !state.armed
  buttons.reset.disabled = !state.armed && !takeoverOpen && state.lastIdleAt === null
}

idleIntervalSelect.addEventListener('change', async () => {
  await browser.runtime.sendMessage({ type: 'set-idle-interval', idleIntervalSeconds: Number(idleIntervalSelect.value) })
  await refresh()
})

buttons.arm.addEventListener('click', async () => { await browser.runtime.sendMessage({ type: 'arm' }); await refresh() })
buttons.demo.addEventListener('click', async () => { await browser.runtime.sendMessage({ type: 'demo-now' }); await refresh() })
buttons.disarm.addEventListener('click', async () => { await browser.runtime.sendMessage({ type: 'disarm' }); await refresh() })
buttons.reset.addEventListener('click', async () => { await browser.runtime.sendMessage({ type: 'reset' }); await refresh() })

void refresh()
