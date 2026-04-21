import '../../style.css'
import { type BackgroundMessage } from '../../core/messages'
import { takeoverCopy } from './copy'
import {
  checkpointGameShellSession,
  clearGameShellSession,
  openGameShellSession,
  type GameShellSession,
} from './session'

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
    <div class="checkpoint-card">
      <div class="log-title">${takeoverCopy.lifecycleTitle}</div>
      <div class="checkpoint-grid">
        <div class="checkpoint-item"><span class="checkpoint-label">${takeoverCopy.lifecycleLabels.resumeCount}</span><strong id="resume-count"></strong></div>
        <div class="checkpoint-item"><span class="checkpoint-label">${takeoverCopy.lifecycleLabels.lastCheckpoint}</span><strong id="checkpoint-at"></strong></div>
      </div>
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
const resumeCount = app.querySelector<HTMLElement>('#resume-count')!
const checkpointAt = app.querySelector<HTMLElement>('#checkpoint-at')!
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
const totalSteps = fields.length
let completed = false
let currentStep = 0
let trackedLogs: string[] = []

function setStep(index: number) {
  currentStep = Math.min(index + 1, totalSteps)
  const step = Math.min(index + 1, totalSteps)

  stagePill.textContent = takeoverCopy.stepPill(step)
  statusText.textContent = takeoverCopy.stepStatuses[index] ?? 'Simulation complete.'
  progressFill.style.width = `${(step / totalSteps) * 100}%`
  stepper.querySelectorAll('span').forEach((item, itemIndex) => {
    item.classList.toggle('is-active', itemIndex === index)
    item.classList.toggle('is-complete', itemIndex < index)
  })
}

function setComplete() {
  completed = true
  currentStep = totalSteps
  completion.hidden = false
  progressFill.style.width = '100%'
  stepper.querySelectorAll('span').forEach((item) => {
    item.classList.remove('is-active')
    item.classList.add('is-complete')
  })
  stagePill.textContent = takeoverCopy.complete
  statusText.textContent = takeoverCopy.completeStatus
}

function pushLog(message: string) {
  const li = document.createElement('li')
  li.textContent = message
  logList.appendChild(li)
  trackedLogs.push(message)
}

function formatTimestamp(value: number | null) {
  if (!value) return 'Not yet'

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value))
}

function renderLifecycle(session: GameShellSession) {
  resumeCount.textContent = String(session.resumeCount)
  checkpointAt.textContent = formatTimestamp(session.lastCheckpointAt ?? session.lastHiddenAt)
}

function hydrateFromSession(session: GameShellSession) {
  trackedLogs = [...session.logs]
  logList.innerHTML = ''
  trackedLogs.forEach((message) => {
    const li = document.createElement('li')
    li.textContent = message
    logList.appendChild(li)
  })

  fills.forEach((el, index) => {
    el.textContent = index < session.currentStep ? (fields[index]?.value ?? 'queued') : ''
  })

  if (session.completed) {
    setComplete()
    return
  }

  if (session.currentStep > 0) {
    setStep(Math.min(session.currentStep, totalSteps - 1))
    return
  }

  setStep(0)
}

async function persistShellState(partial: Partial<GameShellSession> = {}) {
  const session = await checkpointGameShellSession({
    currentStep,
    completed,
    logs: trackedLogs,
    lastHiddenAt: document.hidden ? Date.now() : null,
    ...partial,
  })
  renderLifecycle(session)
}

async function run() {
  const session = await openGameShellSession()
  hydrateFromSession(session)
  renderLifecycle(session)

  if (session.resumeCount > 0) {
    pushLog(takeoverCopy.restored(session.resumeCount))
    await persistShellState()
  }

  if (session.completed) {
    return
  }

  if (trackedLogs.length === 0) {
    pushLog(logs[0])
    await persistShellState({ currentStep: 0 })
  }

  await sleep(300)

  for (const [index, el] of fills.entries()) {
    if (index < session.currentStep) continue

    setStep(Math.min(index + 1, 3))
    pushLog(logs[index + 1] ?? 'Advancing the local shell.')
    el.textContent = fields[index]?.value ?? 'queued'
    await persistShellState({ currentStep: index + 1 })
    await sleep(180)
  }

  setStep(totalSteps - 1)
  pushLog(logs[4])
  setComplete()
  await persistShellState({ completed: true, currentStep: totalSteps })
}

resetButton?.addEventListener('click', async () => {
  await clearGameShellSession()
  window.location.reload()
})

dismissButton?.addEventListener('click', async () => {
  await persistShellState({ lastHiddenAt: Date.now() })
  await browser.runtime.sendMessage({ type: 'disarm' } satisfies BackgroundMessage)
  window.close()
})

window.addEventListener('keydown', async (event) => {
  if (event.key !== 'Escape') return
  dismissButton?.click()
})

document.addEventListener('visibilitychange', () => {
  if (!document.hidden) return
  void persistShellState({ lastHiddenAt: Date.now() })
})

window.addEventListener('pagehide', () => {
  void persistShellState({ lastHiddenAt: Date.now() })
})

void run()
