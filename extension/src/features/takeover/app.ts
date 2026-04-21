import '../../style.css'
import { type BackgroundMessage } from '../../core/messages'
import { takeoverCopy } from './copy'

document.body.classList.add('takeover-mode')

const app = document.querySelector<HTMLDivElement>('#app')
if (!app) throw new Error('Missing takeover root')

app.innerHTML = `
<main class="takeover">
  <header>
    <p class="eyebrow">${takeoverCopy.eyebrow}</p>
    <div class="safety-banner">${takeoverCopy.banner}</div>
    <h1>${takeoverCopy.title}</h1>
    <p class="lede">${takeoverCopy.lede}</p>
  </header>
  <section class="card stage" id="stage">
    <div class="status-row">
      <div>
        <p class="eyebrow compact">${takeoverCopy.sessionStatus}</p>
        <div class="status-text" id="status-text">${takeoverCopy.booting}</div>
      </div>
      <div class="stage-pill" id="stage-pill">${takeoverCopy.stepPill(1)}</div>
    </div>
    <div class="progress-track" aria-hidden="true"><div class="progress-fill" id="progress-fill"></div></div>
    <div class="stepper" id="stepper">
      ${takeoverCopy.stepLabels.map((label) => `<span>${label}</span>`).join('')}
    </div>
    <div class="shell-grid" id="form-grid"></div>
    <div class="log-panel">
      <div class="log-title">${takeoverCopy.logTitle}</div>
      <ul class="log-list" id="log-list"></ul>
    </div>
    <div class="completion" id="completion" hidden>
      <div class="completion-badge">${takeoverCopy.completionTitle}</div>
      <p>${takeoverCopy.completionBody}</p>
    </div>
  </section>
  <div class="actions">
    <button type="button" id="reset">${takeoverCopy.buttons.reset}</button>
    <button type="button" id="dismiss">${takeoverCopy.buttons.dismiss}</button>
  </div>
</main>`

const formGrid = app.querySelector<HTMLElement>('#form-grid')!
const statusText = app.querySelector<HTMLElement>('#status-text')!
const stagePill = app.querySelector<HTMLElement>('#stage-pill')!
const progressFill = app.querySelector<HTMLElement>('#progress-fill')!
const stepper = app.querySelector<HTMLElement>('#stepper')!
const logList = app.querySelector<HTMLUListElement>('#log-list')!
const completion = app.querySelector<HTMLElement>('#completion')!
const dismissButton = app.querySelector<HTMLButtonElement>('#dismiss')
const resetButton = app.querySelector<HTMLButtonElement>('#reset')

const fields = takeoverCopy.fields

formGrid.innerHTML = fields
  .map((field) => `<div class="field"><label>${field.label}</label><div class="input" data-fill></div></div>`)
  .join('') + `<div class="note">${takeoverCopy.note}</div>`

const fills = [...formGrid.querySelectorAll<HTMLElement>('[data-fill]')]
const logs = takeoverCopy.logs

const sleep = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms))

function setStep(index: number) {
  const step = Math.min(index + 1, 4)

  stagePill.textContent = takeoverCopy.stepPill(step)
  statusText.textContent = takeoverCopy.stepStatuses[index] ?? 'Simulation complete.'
  progressFill.style.width = `${(step / 4) * 100}%`
  stepper.querySelectorAll('span').forEach((item, itemIndex) => {
    item.classList.toggle('is-active', itemIndex === index)
    item.classList.toggle('is-complete', itemIndex < index)
  })
}

function pushLog(message: string) {
  const li = document.createElement('li')
  li.textContent = message
  logList.appendChild(li)
}

async function run() {
  setStep(0)
  pushLog(logs[0])
  await sleep(300)

  for (const [index, el] of fills.entries()) {
    setStep(Math.min(index + 1, 3))
    pushLog(logs[index + 1] ?? 'Advancing the fake flow.')
    el.textContent = fields[index]?.value ?? 'queued'
    await sleep(180)
  }

  setStep(4)
  pushLog(logs[4])
  completion.hidden = false
  stagePill.textContent = takeoverCopy.complete
  statusText.textContent = takeoverCopy.completeStatus
}

resetButton?.addEventListener('click', () => window.location.reload())

dismissButton?.addEventListener('click', async () => {
  await browser.runtime.sendMessage({ type: 'disarm' } satisfies BackgroundMessage)
  const currentTab = await browser.tabs.getCurrent()
  if (currentTab?.id !== undefined) {
    await browser.tabs.remove(currentTab.id)
  }
})

window.addEventListener('keydown', async (event) => {
  if (event.key !== 'Escape') return
  dismissButton?.click()
})

void run()
