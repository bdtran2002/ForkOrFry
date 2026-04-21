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
import { BURGER_LEVEL, getBurgerAdjacentPosition, getBurgerRecipe, getBurgerTile, type BurgerDirection } from './burger-level'
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
    <div class="field">
      <label>${runtimeFrameCopy.labels.kitchen}</label>
      <div class="kitchen-map" id="kitchen-map"></div>
    </div>
    <div class="kitchen-legend">
      <div class="log-title">${runtimeFrameCopy.kitchenLegendTitle}</div>
      <div class="legend-items">${runtimeFrameCopy.tileLegend.map(({ glyph, label }) => `<span class="legend-item"><strong>${glyph}</strong>${label}</span>`).join('')}</div>
    </div>
    <div class="shell-grid" id="state-grid">
      <div class="field"><label>${runtimeFrameCopy.labels.tick}</label><div class="input" id="tick-value"></div></div>
      <div class="field"><label>${runtimeFrameCopy.labels.score}</label><div class="input" id="score-value"></div></div>
      <div class="field"><label>${runtimeFrameCopy.labels.shift}</label><div class="input" id="shift-value"></div></div>
      <div class="field"><label>${runtimeFrameCopy.labels.location}</label><div class="input" id="location-value"></div></div>
      <div class="field"><label>${runtimeFrameCopy.labels.facing}</label><div class="input" id="facing-value"></div></div>
      <div class="field"><label>${runtimeFrameCopy.labels.heldItem}</label><div class="input" id="held-item-value"></div></div>
      <div class="field"><label>${runtimeFrameCopy.labels.order}</label><div class="input" id="order-value"></div></div>
      <div class="field"><label>${runtimeFrameCopy.labels.nextTicket}</label><div class="input" id="next-ticket-value"></div></div>
      <div class="field"><label>${runtimeFrameCopy.labels.upcomingOrders}</label><div class="input" id="upcoming-orders-value"></div></div>
      <div class="field"><label>${runtimeFrameCopy.labels.activeTile}</label><div class="input" id="active-tile-value"></div></div>
      <div class="field"><label>${runtimeFrameCopy.labels.grill}</label><div class="input" id="grill-value"></div></div>
      <div class="field"><label>${runtimeFrameCopy.labels.grillPressure}</label><div class="input" id="grill-pressure-value"></div></div>
      <div class="field"><label>${runtimeFrameCopy.labels.board}</label><div class="input" id="board-value"></div></div>
      <div class="field"><label>${runtimeFrameCopy.labels.counter}</label><div class="input" id="counter-value"></div></div>
      <div class="field"><label>${runtimeFrameCopy.labels.pantry}</label><div class="input" id="pantry-value"></div></div>
    </div>
    <p class="helper runtime-helper">${runtimeFrameCopy.movementHint}</p>
    <div class="actions runtime-controls" id="move-actions">
      ${runtimeFrameCopy.directionItems.map(({ id, label, key }) => `<button type="button" class="secondary" data-direction="${id}" data-key="${key}">${label}</button>`).join('')}
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
const kitchenMap = app.querySelector<HTMLElement>('#kitchen-map')!
const tickValue = app.querySelector<HTMLElement>('#tick-value')!
const scoreValue = app.querySelector<HTMLElement>('#score-value')!
const shiftValue = app.querySelector<HTMLElement>('#shift-value')!
const locationValue = app.querySelector<HTMLElement>('#location-value')!
const facingValue = app.querySelector<HTMLElement>('#facing-value')!
const heldItemValue = app.querySelector<HTMLElement>('#held-item-value')!
const orderValue = app.querySelector<HTMLElement>('#order-value')!
const nextTicketValue = app.querySelector<HTMLElement>('#next-ticket-value')!
const upcomingOrdersValue = app.querySelector<HTMLElement>('#upcoming-orders-value')!
const activeTileValue = app.querySelector<HTMLElement>('#active-tile-value')!
const grillValue = app.querySelector<HTMLElement>('#grill-value')!
const grillPressureValue = app.querySelector<HTMLElement>('#grill-pressure-value')!
const boardValue = app.querySelector<HTMLElement>('#board-value')!
const counterValue = app.querySelector<HTMLElement>('#counter-value')!
const pantryValue = app.querySelector<HTMLElement>('#pantry-value')!
const moveActions = [...app.querySelectorAll<HTMLButtonElement>('[data-direction]')]
const interactButton = app.querySelector<HTMLButtonElement>('#interact')!
const tickButton = app.querySelector<HTMLButtonElement>('#tick')!
const resetButton = app.querySelector<HTMLButtonElement>('#reset')!
const logList = app.querySelector<HTMLUListElement>('#log-list')!
const completion = app.querySelector<HTMLElement>('#completion')!
const completionBody = app.querySelector<HTMLElement>('#completion-body')!

let sessionId = ''
let state: BurgerSessionState = createInitialBurgerSessionState()
const directionLabels = Object.fromEntries(runtimeFrameCopy.directionItems.map(({ id, label }) => [id, label])) as Record<BurgerDirection, string>
const legendById = Object.fromEntries(runtimeFrameCopy.tileLegend.map((item) => [item.id, item]))

function renderKitchenMap() {
  const maxX = Math.max(...BURGER_LEVEL.tiles.map((tile) => tile.x))
  const maxY = Math.max(...BURGER_LEVEL.tiles.map((tile) => tile.y))

  kitchenMap.style.gridTemplateColumns = `repeat(${maxX + 1}, minmax(0, 1fr))`
  kitchenMap.innerHTML = ''

  for (let y = 0; y <= maxY; y += 1) {
    for (let x = 0; x <= maxX; x += 1) {
      const tile = BURGER_LEVEL.tiles.find((entry) => entry.x === x && entry.y === y)
      const cell = document.createElement('div')
      const isPlayer = state.player.position.x === x && state.player.position.y === y
      const facingTile = getBurgerAdjacentPosition(state.player.position, state.player.facing)
      const isFacing = facingTile.x === x && facingTile.y === y

      cell.className = 'kitchen-tile'
      cell.classList.toggle('is-wall', !tile?.walkable)
      cell.classList.toggle('is-interactable', Boolean(tile?.interactable))
      cell.classList.toggle('is-player', isPlayer)
      cell.classList.toggle('is-facing', isFacing)
      cell.setAttribute('aria-label', tile?.interactable ?? (tile?.walkable ? 'walkable tile' : 'wall'))

      if (tile?.interactable) {
        cell.textContent = legendById[tile.interactable]?.glyph ?? '?'
      }

      if (isPlayer) {
        const marker = document.createElement('span')
        marker.className = 'player-marker'
        marker.textContent = '●'
        cell.appendChild(marker)
      }

      kitchenMap.appendChild(cell)
    }
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
    checkpoint: createBurgerSessionCheckpoint(RUNTIME_ID, state),
  })
}

function currentPhase() {
  return state.phase === 'completed' ? 'ready' : state.phase
}

function currentPhaseDetail() {
  if (state.phase === 'completed') {
    return runtimeFrameCopy.readySummary(state.shift.servedCount, state.shift.failedCount)
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
  const completedOrders = state.shift.servedCount + state.shift.failedCount
  if (state.phase === 'completed') return 100
  if (state.activeOrders.length === 0) return Math.max((completedOrders / state.shift.totalOrders) * 100, 0)

  const activeProgress = state.activeOrders.reduce((sum, order) => {
    return sum + (1 - (order.remainingTicks / order.durationTicks))
  }, 0)

  return Math.max(((completedOrders + activeProgress) / state.shift.totalOrders) * 100, 0)
}

function grillPressureText() {
  if (state.stations.grill.patty === 'empty') return runtimeFrameCopy.emptyValue
  if (state.stations.grill.patty === 'burnt') return 'Clear the grill before cooking again'
  if (state.stations.grill.patty === 'cooking') {
    const ticksUntilCooked = Math.max(BURGER_LEVEL.grillCookTicks - state.stations.grill.progressTicks, 0)
    return `${ticksUntilCooked} tick${ticksUntilCooked === 1 ? '' : 's'} until cooked`
  }

  const safeTicks = Math.max(BURGER_LEVEL.grillBurnTicks - state.stations.grill.progressTicks, 0)
  return runtimeFrameCopy.grillPressureSummary(safeTicks)
}

function nextScheduledTicket() {
  return state.upcomingOrders[0] ?? null
}

function nextTicketText() {
  const nextTicket = nextScheduledTicket()
  if (!nextTicket) return runtimeFrameCopy.noNextTicket

  const ticksUntilRelease = Math.max(nextTicket.releaseTick - state.tick, 0)
  return `${getBurgerRecipe(nextTicket.recipeId).label} · ${runtimeFrameCopy.nextTicketSummary(ticksUntilRelease)}`
}

function render() {
  statusText.textContent = runtimeFrameCopy.phaseLabels[state.phase]
  stagePill.textContent = `${runtimeFrameCopy.phasePrefix} ${state.phase}`
  progressFill.style.width = `${orderProgressPercent()}%`
  tickValue.textContent = String(state.tick)
  scoreValue.textContent = String(state.score)
  shiftValue.textContent = `${state.shift.servedCount} served · ${state.shift.failedCount} failed · ${state.shift.completedOrders.length}/${state.shift.totalOrders} complete`
  locationValue.textContent = `${state.player.position.x}, ${state.player.position.y}`
  facingValue.textContent = directionLabels[state.player.facing]
  heldItemValue.textContent = state.player.heldItem ?? runtimeFrameCopy.emptyValue
  orderValue.textContent = state.activeOrders.length > 0
    ? state.activeOrders
      .map((order) => `${order.id}: ${getBurgerRecipe(order.recipeId).label} · ${order.remainingTicks}/${order.durationTicks} ticks left`)
      .join(' | ')
    : runtimeFrameCopy.noCurrentOrder
  nextTicketValue.textContent = nextTicketText()
  upcomingOrdersValue.textContent = state.upcomingOrders.length > 0
    ? state.upcomingOrders.map((order) => `${order.id}: ${getBurgerRecipe(order.recipeId).label} · in ${Math.max(order.releaseTick - state.tick, 0)} ticks`).join(', ')
    : runtimeFrameCopy.noUpcomingOrders
  activeTileValue.textContent = (() => {
    const tile = getBurgerTile(state.player.position)
    const forwardTile = getBurgerTile(getBurgerAdjacentPosition(state.player.position, state.player.facing))
    const interactable = tile?.interactable ?? forwardTile?.interactable
    return interactable ? legendById[interactable]?.label ?? interactable : runtimeFrameCopy.noActiveTile
  })()
  grillValue.textContent = `${runtimeFrameCopy.grillStates[state.stations.grill.patty]} · ${state.stations.grill.progressTicks}/${BURGER_LEVEL.grillBurnTicks}`
  grillPressureValue.textContent = grillPressureText()
  boardValue.textContent = state.stations.board.items.join(', ') || runtimeFrameCopy.emptyValue
  counterValue.textContent = state.stations.counter.finishedBurger
    ? getBurgerRecipe(state.stations.counter.finishedBurger).label
    : runtimeFrameCopy.noCounterItem
  pantryValue.textContent = `bun ${state.inventory.bun} · patty ${state.inventory.patty} · cheese ${state.inventory.cheese}`
  renderKitchenMap()

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
  completionBody.textContent = runtimeFrameCopy.completionSummary(state.shift.servedCount, state.shift.failedCount)
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
    dispatch({ type: 'move', direction: button.dataset.direction as BurgerDirection })
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

window.addEventListener('keydown', (event) => {
  const match = runtimeFrameCopy.directionItems.find((item) => item.key === event.key)
  if (!match || state.phase === 'paused' || state.phase === 'completed') return

  event.preventDefault()
  dispatch({ type: 'move', direction: match.id })
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
