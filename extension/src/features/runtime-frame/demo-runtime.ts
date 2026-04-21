import '../../style.css'
import {
  type HostToRuntimeMessage,
  isHostToRuntimeMessage,
  RUNTIME_PROTOCOL_VERSION,
  type RuntimeCheckpointEnvelope,
  type RuntimeStatusPhase,
  type RuntimeToHostMessage,
} from '../runtime-host/contract'
import { runtimeFrameCopy } from './copy'

const RUNTIME_ID = 'demo-runtime'

interface DemoRuntimeState {
  currentStep: number
  completed: boolean
  logs: string[]
}

const app = document.querySelector<HTMLDivElement>('#app')

if (!app) throw new Error('Missing runtime frame root')

app.innerHTML = `
<main class="takeover runtime-frame-shell">
  <section class="card stage">
    <header>
      <p class="eyebrow">${runtimeFrameCopy.eyebrow}</p>
      <h2>${runtimeFrameCopy.title}</h2>
      <p class="lede">${runtimeFrameCopy.lede}</p>
    </header>
    <div class="status-row">
      <div>
        <p class="eyebrow compact">${runtimeFrameCopy.sessionStatus}</p>
        <div class="status-text" id="status-text">${runtimeFrameCopy.booting}</div>
      </div>
      <div class="stage-pill" id="stage-pill">${runtimeFrameCopy.stepPill(1)}</div>
    </div>
    <div class="progress-track" aria-hidden="true"><div class="progress-fill" id="progress-fill"></div></div>
    <div class="stepper" id="stepper">
      ${runtimeFrameCopy.stepLabels.map((label) => `<span>${label}</span>`).join('')}
    </div>
    <div class="shell-grid" id="form-grid"></div>
    <div class="log-panel">
      <div class="log-title">${runtimeFrameCopy.logTitle}</div>
      <ul class="log-list" id="log-list"></ul>
    </div>
    <div class="completion" id="completion" hidden>
      <div class="completion-badge">${runtimeFrameCopy.completionTitle}</div>
      <p>${runtimeFrameCopy.completionBody}</p>
    </div>
  </section>
</main>`

const formGrid = app.querySelector<HTMLElement>('#form-grid')!
const statusText = app.querySelector<HTMLElement>('#status-text')!
const stagePill = app.querySelector<HTMLElement>('#stage-pill')!
const progressFill = app.querySelector<HTMLElement>('#progress-fill')!
const stepper = app.querySelector<HTMLElement>('#stepper')!
const logList = app.querySelector<HTMLUListElement>('#log-list')!
const completion = app.querySelector<HTMLElement>('#completion')!

const fields = runtimeFrameCopy.fields
const totalSteps = fields.length

formGrid.innerHTML = fields
  .map((field) => `<div class="field"><label>${field.label}</label><div class="input" data-fill></div></div>`)
  .join('') + `<div class="note">${runtimeFrameCopy.note}</div>`

const fills = [...formGrid.querySelectorAll<HTMLElement>('[data-fill]')]

let sessionId = ''
let state: DemoRuntimeState = createInitialState()
let paused = false
let timer: number | null = null

function createInitialState(): DemoRuntimeState {
  return {
    currentStep: 0,
    completed: false,
    logs: [],
  }
}

function hydrate(checkpoint: RuntimeCheckpointEnvelope<DemoRuntimeState> | null) {
  if (!checkpoint || checkpoint.runtimeId !== RUNTIME_ID) {
    state = createInitialState()
    return
  }

  state = {
    currentStep: checkpoint.state.currentStep,
    completed: checkpoint.state.completed,
    logs: [...checkpoint.state.logs],
  }
}

function postToHost(message: RuntimeToHostMessage) {
  window.parent.postMessage(message, window.location.origin)
}

function postStatus(phase: RuntimeStatusPhase, detail: string) {
  postToHost({
    type: 'runtime:status',
    runtimeId: RUNTIME_ID,
    phase,
    detail,
  })
}

function postCheckpoint() {
  postToHost({
    type: 'runtime:checkpoint',
    runtimeId: RUNTIME_ID,
    checkpoint: {
      version: RUNTIME_PROTOCOL_VERSION,
      runtimeId: RUNTIME_ID,
      updatedAt: Date.now(),
      state: {
        currentStep: state.currentStep,
        completed: state.completed,
        logs: [...state.logs],
      },
    },
  })
}

function clearTimer() {
  if (timer !== null) {
    window.clearTimeout(timer)
    timer = null
  }
}

function render() {
  const activeIndex = state.completed ? totalSteps - 1 : Math.min(state.currentStep, totalSteps - 1)
  const progressStep = state.completed ? totalSteps : Math.max(state.currentStep, 1)

  statusText.textContent = state.completed
    ? runtimeFrameCopy.completeStatus
    : paused
      ? runtimeFrameCopy.pausedStatus
      : runtimeFrameCopy.stepStatuses[activeIndex] ?? runtimeFrameCopy.booting
  stagePill.textContent = state.completed ? 'Ready' : runtimeFrameCopy.stepPill(activeIndex + 1)
  progressFill.style.width = `${(progressStep / totalSteps) * 100}%`
  completion.hidden = !state.completed

  stepper.querySelectorAll('span').forEach((item, itemIndex) => {
    item.classList.toggle('is-active', !state.completed && itemIndex === activeIndex)
    item.classList.toggle('is-complete', state.completed || itemIndex < state.currentStep)
  })

  fills.forEach((el, index) => {
    el.textContent = index < state.currentStep ? (fields[index]?.value ?? 'queued') : ''
  })

  logList.innerHTML = ''
  state.logs.forEach((message) => {
    const li = document.createElement('li')
    li.textContent = message
    logList.appendChild(li)
  })
}

function scheduleAdvance() {
  clearTimer()
  if (paused || state.completed) return

  timer = window.setTimeout(() => {
    if (state.logs.length === 0) {
      state.logs.push(runtimeFrameCopy.logs[0])
      render()
      postStatus('running', runtimeFrameCopy.stepStatuses[0])
      postCheckpoint()
      scheduleAdvance()
      return
    }

    if (state.currentStep >= totalSteps) {
      state.completed = true
      render()
      postStatus('ready', runtimeFrameCopy.completeStatus)
      postCheckpoint()
      return
    }

    const nextStep = state.currentStep + 1
    state.currentStep = nextStep
    state.logs.push(runtimeFrameCopy.logs[nextStep] ?? 'Advanced the runtime state.')

    if (nextStep >= totalSteps) {
      state.completed = true
      render()
      postStatus('ready', runtimeFrameCopy.completeStatus)
      postCheckpoint()
      return
    }

    render()
    postStatus('running', runtimeFrameCopy.stepStatuses[nextStep] ?? runtimeFrameCopy.stepStatuses.at(-1) ?? runtimeFrameCopy.booting)
    postCheckpoint()
    scheduleAdvance()
  }, 220)
}

function boot(checkpoint: RuntimeCheckpointEnvelope<DemoRuntimeState> | null, nextSessionId: string) {
  sessionId = nextSessionId
  paused = false
  hydrate(checkpoint)
  render()
  postStatus('booting', `Boot accepted for ${sessionId.slice(0, 8)}.`)
  postToHost({
    type: 'runtime:ready',
    runtimeId: RUNTIME_ID,
    capabilities: [...runtimeFrameCopy.capabilities],
  })
  postCheckpoint()
  scheduleAdvance()
}

function handleHostMessage(message: HostToRuntimeMessage) {
  switch (message.type) {
    case 'host:boot':
      boot(message.checkpoint as RuntimeCheckpointEnvelope<DemoRuntimeState> | null, message.sessionId)
      return
    case 'host:pause':
      paused = true
      clearTimer()
      render()
      postStatus('paused', message.reason)
      postCheckpoint()
      return
    case 'host:resume':
      paused = false
      hydrate(message.checkpoint as RuntimeCheckpointEnvelope<DemoRuntimeState> | null)
      render()
      postStatus('running', 'Resumed from the latest host checkpoint.')
      postCheckpoint()
      scheduleAdvance()
      return
    case 'host:shutdown':
      clearTimer()
      postCheckpoint()
  }
}

window.addEventListener('message', (event) => {
  if (event.source !== window.parent || event.origin !== window.location.origin) return
  if (!isHostToRuntimeMessage(event.data)) return

  if ('runtimeId' in event.data && event.data.runtimeId !== RUNTIME_ID) return

  handleHostMessage(event.data)
})

document.addEventListener('visibilitychange', () => {
  if (!document.hidden) return
  postCheckpoint()
})

window.addEventListener('pagehide', () => {
  clearTimer()
  postCheckpoint()
})

render()
