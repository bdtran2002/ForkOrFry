import './style.css'
import { getState } from './shared'

const app = document.querySelector<HTMLDivElement>('#app')
if (!app) throw new Error('Missing popup root')

app.innerHTML = `
<main class="popup">
  <p class="eyebrow">ForkOrFry</p>
  <h1>Arm the fryer</h1>
  <p class="lede">Firefox-only local parody. Idle detection opens a takeover tab; nothing is injected, submitted, or sent anywhere.</p>
  <div class="status" id="status"></div>
  <div class="actions">
    <button type="button" class="primary" id="arm">Arm</button>
    <button type="button" class="secondary" id="demo">Demo now</button>
    <button type="button" class="secondary" id="disarm">Disarm</button>
    <button type="button" class="secondary" id="reset">Clear state</button>
  </div>
  <p class="helper">Clear state removes the stored idle timestamp and closes any open takeover tab.</p>
</main>`

const status = app.querySelector<HTMLElement>('#status')!
const buttons = {
  arm: app.querySelector<HTMLButtonElement>('#arm')!,
  demo: app.querySelector<HTMLButtonElement>('#demo')!,
  disarm: app.querySelector<HTMLButtonElement>('#disarm')!,
  reset: app.querySelector<HTMLButtonElement>('#reset')!,
}

async function refresh() {
  const state = await getState()
  status.textContent = state.armed
    ? 'Armed. Firefox idle will open the takeover tab.'
    : 'Disarmed. The prank is paused until you arm it.'
  buttons.arm.disabled = state.armed
  buttons.disarm.disabled = !state.armed
}

buttons.arm.addEventListener('click', async () => { await browser.runtime.sendMessage({ type: 'arm' }); await refresh() })
buttons.demo.addEventListener('click', async () => { await browser.runtime.sendMessage({ type: 'demo-now' }); await refresh() })
buttons.disarm.addEventListener('click', async () => { await browser.runtime.sendMessage({ type: 'disarm' }); await refresh() })
buttons.reset.addEventListener('click', async () => { await browser.runtime.sendMessage({ type: 'reset' }); await refresh() })

void refresh()
