import '../../style.css'
import {
  type HostToRuntimeMessage,
  isHostToRuntimeMessage,
  type RuntimeCheckpointEnvelope,
  type RuntimeStatusPhase,
  type RuntimeToHostMessage,
} from '../runtime-host/contract'
import { createBurgerSessionCheckpoint, restoreBurgerSessionCheckpoint } from './checkpoint'
import { runtimeFrameCopy } from './copy'
import { BURGER_LEVEL, type BurgerStationId } from './burger-level'
import { reduceBurgerSession } from './burger-session-reducer'
import { createInitialBurgerSessionState, type BurgerSessionState } from './burger-session-state'

const RUNTIME_ID = 'burger-runtime'

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
      <div class="stage-pill" id="stage-pill"></div>
    </div>
    <div class="progress-track" aria-hidden="true"><div class="progress-fill" id="progress-fill"></div></div>
    <div class="stepper" id="location-stepper">
      ${runtimeFrameCopy.locationItems.map(({ label }) => `<span>${label}</span>`).join('')}
    </div>
    <div class="shell-grid" id="state-grid">
      <div class="field"><label>${runtimeFrameCopy.labels.tick}</label><div class="input" id="tick-value"></div></div>
      <div class="field"><label>${runtimeFrameCopy.labels.score}</label><div class="input" id="score-value"></div></div>
      <div class="field"><label>${runtimeFrameCopy.labels.location}</label><div class="input" id="location-value"></div></div>
      <div class="field"><label>${runtimeFrameCopy.labels.heldItem}</label><div class="input" id="held-item-value"></div></div>
      <div class="field"><label>${runtimeFrameCopy.labels.order}</label><div class="input" id="order-value"></div></div>
      <div class="field"><label>${runtimeFrameCopy.labels.grill}</label><div class="input" id="grill-value"></div></div>
      <div class="field"><label>${runtimeFrameCopy.labels.board}</label><div class="input" id="board-value"></div></div>
      <div class="field"><label>${runtimeFrameCopy.labels.pantry}</label><div class="input" id="pantry-value"></div></div>
    </div>
    <div class="actions runtime-controls" id="move-actions">
      ${runtimeFrameCopy.locationItems.map(({ id, label }) => `<button type="button" class="secondary" data-move="${id}">${label}</button>`).join('')}
    </div>
    <div class="actions runtime-controls">
      <button type="button" class="primary" id="interact">${runtimeFrameCopy.buttons.interact}</button>
      <button type="button" class="secondary" id="tick">${runtimeFrameCopy.buttons.tick}</button>
      <button type="button" class="secondary" id="reset">${runtimeFrameCopy.buttons.reset}</button>
    </div>
    <div class="log-panel">
      <div class="log-title">${runtimeFrameCopy.logTitle}</div>
      <ul class="log-list" id="log-list"></ul>
    </div>
    <div class="completion" id="completion" hidden>
      <div class="completion-badge">${runtimeFrameCopy.completionTitle}</div>
      <p id="completion-body"></p>
    </div>
  </section>
</main>`

const statusText = app.querySelector<HTMLElement>('#status-text')!
const stagePill = app.querySelector<HTMLElement>('#stage-pill')!
const progressFill = app.querySelector<HTMLElement>('#progress-fill')!
const locationStepper = app.querySelector<HTMLElement>('#location-stepper')!
const tickValue = app.querySelector<HTMLElement>('#tick-value')!
const scoreValue = app.querySelector<HTMLElement>('#score-value')!
const locationValue = app.querySelector<HTMLElement>('#location-value')!
const heldItemValue = app.querySelector<HTMLElement>('#held-item-value')!
const orderValue = app.querySelector<HTMLElement>('#order-value')!
const grillValue = app.querySelector<HTMLElement>('#grill-value')!
const boardValue = app.querySelector<HTMLElement>('#board-value')!
const pantryValue = app.querySelector<HTMLElement>('#pantry-value')!
const moveActions = [...app.querySelectorAll<HTMLButtonElement>('[data-move]')]
const interactButton = app.querySelector<HTMLButtonElement>('#interact')!
const tickButton = app.querySelector<HTMLButtonElement>('#tick')!
const resetButton = app.querySelector<HTMLButtonElement>('#reset')!
const logList = app.querySelector<HTMLUListElement>('#log-list')!
const completion = app.querySelector<HTMLElement>('#completion')!
const completionBody = app.querySelector<HTMLElement>('#completion-body')!

let sessionId = ''
let state: BurgerSessionState = createInitialBurgerSessionState()
const locationLabels = Object.fromEntries(runtimeFrameCopy.locationItems.map(({ id, label }) => [id, label])) as Record<BurgerStationId, string>

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
    checkpoint: createBurgerSessionCheckpoint(RUNTIME_ID, state),
  })
}

function currentPhase() {
  return state.phase === 'completed' ? 'ready' : state.phase
}

function currentPhaseDetail() {
  if (state.phase === 'completed') {
    return state.activeOrder.status === 'served'
      ? runtimeFrameCopy.readyServed
      : runtimeFrameCopy.readyFailed
  }

  return runtimeFrameCopy.phaseLabels[state.phase]
}

function dispatch(action: Parameters<typeof reduceBurgerSession>[1], options?: { post?: boolean }) {
  state = reduceBurgerSession(state, action)
  render()

  if (options?.post === false) return

  postStatus(currentPhase(), currentPhaseDetail())
  postCheckpoint()
}

function orderProgressPercent() {
  return Math.max((state.activeOrder.remainingTicks / 18) * 100, 0)
}

function render() {
  statusText.textContent = runtimeFrameCopy.phaseLabels[state.phase]
  stagePill.textContent = `${runtimeFrameCopy.phasePrefix} ${state.phase}`
  progressFill.style.width = `${orderProgressPercent()}%`
  tickValue.textContent = String(state.tick)
  scoreValue.textContent = String(state.score)
  locationValue.textContent = locationLabels[state.player.location]
  heldItemValue.textContent = state.player.heldItem ?? runtimeFrameCopy.emptyValue
  orderValue.textContent = `${state.activeOrder.status} · ${state.activeOrder.remainingTicks} ticks left`
  grillValue.textContent = `${state.stations.grill.patty} · ${state.stations.grill.progressTicks}/${BURGER_LEVEL.grillCookTicks}`
  boardValue.textContent = [
    state.stations.board.bun ? 'bun' : null,
    state.stations.board.patty ? 'patty' : null,
    state.stations.board.cheese ? 'cheese' : null,
  ]
    .filter(Boolean)
    .join(', ') || runtimeFrameCopy.emptyValue
  pantryValue.textContent = `bun ${state.inventory.bun} · patty ${state.inventory.patty} · cheese ${state.inventory.cheese}`

  locationStepper.querySelectorAll('span').forEach((item, index) => {
    item.classList.toggle('is-active', runtimeFrameCopy.locationItems[index]?.id === state.player.location)
  })

  const controlsDisabled = state.phase === 'paused' || state.phase === 'completed'
  for (const button of moveActions) {
    button.disabled = controlsDisabled
  }
  interactButton.disabled = controlsDisabled
  tickButton.disabled = controlsDisabled

  logList.innerHTML = ''
  state.log.forEach((message) => {
    const li = document.createElement('li')
    li.textContent = message
    logList.appendChild(li)
  })

  completion.hidden = state.phase !== 'completed'
  completionBody.textContent = state.activeOrder.status === 'served'
    ? runtimeFrameCopy.completionServed
    : runtimeFrameCopy.completionFailed
}

function boot(checkpoint: RuntimeCheckpointEnvelope | null, nextSessionId: string) {
  sessionId = nextSessionId
  const restored = restoreBurgerSessionCheckpoint(RUNTIME_ID, checkpoint)
  state = reduceBurgerSession(restored, { type: 'boot', checkpoint: restored })
  render()
  postStatus('booting', `Boot accepted for ${sessionId.slice(0, 8)}.`)
  postToHost({
    type: 'runtime:ready',
    runtimeId: RUNTIME_ID,
    capabilities: [...runtimeFrameCopy.capabilities],
  })
  postCheckpoint()
  postStatus('running', runtimeFrameCopy.phaseLabels.running)
}

function handleHostMessage(message: HostToRuntimeMessage) {
  switch (message.type) {
    case 'host:boot':
      boot(message.checkpoint, message.sessionId)
      return
    case 'host:pause':
      dispatch({ type: 'pause' }, { post: false })
      postStatus(state.phase === 'paused' ? 'paused' : currentPhase(), state.phase === 'paused' ? message.reason : currentPhaseDetail())
      postCheckpoint()
      return
    case 'host:resume': {
      const restored = restoreBurgerSessionCheckpoint(RUNTIME_ID, message.checkpoint)
      state = reduceBurgerSession(restored, { type: 'resume' })
      render()
      postStatus(state.phase === 'running' ? 'running' : currentPhase(), state.phase === 'running' ? 'Resumed from the latest burger-session checkpoint.' : currentPhaseDetail())
      postCheckpoint()
      return
    }
    case 'host:shutdown':
      postCheckpoint()
  }
}

for (const button of moveActions) {
  button.addEventListener('click', () => {
    dispatch({ type: 'move', location: button.dataset.move as BurgerStationId })
  })
}

interactButton.addEventListener('click', () => {
  dispatch({ type: 'interact' })
})

tickButton.addEventListener('click', () => {
  dispatch({ type: 'tick' })
})

resetButton.addEventListener('click', () => {
  dispatch({ type: 'reset' })
})

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
  postCheckpoint()
})

render()
