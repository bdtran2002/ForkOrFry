import './style.css'

type Phase = 'intro' | 'active' | 'warning' | 'predicting' | 'result'
type InputKind = 'pointer' | 'key' | 'scroll' | 'touch' | 'focus' | 'demo'

interface Prediction {
  title: string
  subtitle: string
  summary: string
  detail: string
  badge: string
  cause: string
}

interface SessionState {
  armed: boolean
  phase: Phase
  sessionId: string
  seed: number
  startedAt: number
  lastActivityAt: number
  activityCount: number
  scrollCount: number
  lastInput: InputKind | 'none'
  prediction: Prediction
}

const STORAGE_KEY = 'forkorfry:future-session:v1'
const WARNING_MS = 4500
const PREDICTING_MS = 8000
const RESULT_MS = 11200

const app = document.querySelector<HTMLDivElement>('#app')

if (!app) {
  throw new Error('Missing #app root')
}

const now = Date.now()

app.innerHTML = `
  <div class="shell" data-phase="intro">
    <div class="orb orb-a"></div>
    <div class="orb orb-b"></div>
    <header class="topbar">
      <div>
        <p class="eyebrow">ForkOrFry</p>
        <p class="topline">idle-triggered CS future predictor</p>
      </div>
      <div class="status-pill" id="phasePill">Arming fryer</div>
    </header>

    <main class="layout">
      <section class="hero-card panel">
        <p class="kicker">Scroll too long. Get a prophecy.</p>
        <h1 id="headline">Your next career move is one reel away from the fries station.</h1>
        <p class="lede" id="lede">
          Tap start, let the feed go quiet, and ForkOrFry will escalate from a light warning to a completely
          unhinged fast-food forecast.
        </p>

        <div class="cta-row">
          <button class="primary-btn" id="primaryCta" type="button">Start scrolling</button>
          <button class="ghost-btn" id="secondaryCta" type="button">Fast-forward demo</button>
        </div>

        <div class="story-strip" aria-label="How it works">
          <article>
            <span>1</span>
            <strong>Arm</strong>
            <p>Hit start and the simulator begins watching for your next act of digital self-destruction.</p>
          </article>
          <article>
            <span>2</span>
            <strong>Idle</strong>
            <p>Stop interacting and the fryer heats up through warning, predicting, and full destiny mode.</p>
          </article>
          <article>
            <span>3</span>
            <strong>Reveal</strong>
            <p>Refreshes keep the current phase, so the prophecy survives your panic reloads.</p>
          </article>
        </div>
      </section>

      <aside class="monitor-card panel" aria-live="polite">
        <div class="monitor-head">
          <div>
            <p class="monitor-label">Live diagnostic area</p>
            <h2>Feed thermals</h2>
          </div>
          <div class="mini-badge" id="stateWord">Dormant</div>
        </div>

        <div class="meter-shell">
          <div class="meter-head">
            <span>Fryer heat</span>
            <strong id="meterLabel">0%</strong>
          </div>
          <div class="meter-track" role="presentation">
            <div class="meter-fill" id="meterFill"></div>
          </div>
          <p class="meter-copy" id="meterCopy">Waiting for you to open the reels.</p>
        </div>

        <dl class="diagnostics">
          <div>
            <dt>Session</dt>
            <dd id="diagSession">—</dd>
          </div>
          <div>
            <dt>Idle timer</dt>
            <dd id="diagIdle">0.0s</dd>
          </div>
          <div>
            <dt>Last input</dt>
            <dd id="diagInput">none</dd>
          </div>
          <div>
            <dt>Scroll hits</dt>
            <dd id="diagScrolls">0</dd>
          </div>
          <div>
            <dt>Activity count</dt>
            <dd id="diagActivity">0</dd>
          </div>
          <div>
            <dt>Threshold</dt>
            <dd id="diagThreshold">warning at 4.5s</dd>
          </div>
        </dl>

        <div class="forecast-note">
          <p class="monitor-label">What the app thinks</p>
          <strong id="diagnosticHeadline">No doomscroll detected yet.</strong>
          <p id="diagnosticBody">Press start to begin the countdown to your apron-era destiny.</p>
        </div>
      </aside>
    </main>

    <section
      class="result-overlay"
      id="resultOverlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="resultTitle"
      aria-describedby="resultDetail"
      hidden
    >
      <div class="result-card panel">
        <p class="result-kicker">Forecast locked</p>
        <h2 id="resultTitle">You are one bag away from greatness.</h2>
        <p class="result-subtitle" id="resultSubtitle"></p>
        <div class="result-grid">
          <div>
            <span>Assigned future</span>
            <strong id="resultBadge"></strong>
          </div>
          <div>
            <span>Why it happened</span>
            <strong id="resultReason"></strong>
          </div>
        </div>
        <p class="result-detail" id="resultDetail"></p>
        <div class="cta-row result-actions">
          <button class="primary-btn" id="resultPrimary" type="button">Roll again</button>
          <button class="ghost-btn" id="resultSecondary" type="button">Close the fryer</button>
        </div>
      </div>
    </section>
  </div>
`

const els = {
  shell: app.querySelector<HTMLElement>('.shell')!,
  phasePill: app.querySelector<HTMLElement>('#phasePill')!,
  stateWord: app.querySelector<HTMLElement>('#stateWord')!,
  primaryCta: app.querySelector<HTMLButtonElement>('#primaryCta')!,
  secondaryCta: app.querySelector<HTMLButtonElement>('#secondaryCta')!,
  headline: app.querySelector<HTMLElement>('#headline')!,
  lede: app.querySelector<HTMLElement>('#lede')!,
  meterLabel: app.querySelector<HTMLElement>('#meterLabel')!,
  meterCopy: app.querySelector<HTMLElement>('#meterCopy')!,
  meterFill: app.querySelector<HTMLElement>('#meterFill')!,
  diagSession: app.querySelector<HTMLElement>('#diagSession')!,
  diagIdle: app.querySelector<HTMLElement>('#diagIdle')!,
  diagInput: app.querySelector<HTMLElement>('#diagInput')!,
  diagScrolls: app.querySelector<HTMLElement>('#diagScrolls')!,
  diagActivity: app.querySelector<HTMLElement>('#diagActivity')!,
  diagThreshold: app.querySelector<HTMLElement>('#diagThreshold')!,
  diagnosticHeadline: app.querySelector<HTMLElement>('#diagnosticHeadline')!,
  diagnosticBody: app.querySelector<HTMLElement>('#diagnosticBody')!,
  resultOverlay: app.querySelector<HTMLElement>('#resultOverlay')!,
  resultTitle: app.querySelector<HTMLElement>('#resultTitle')!,
  resultSubtitle: app.querySelector<HTMLElement>('#resultSubtitle')!,
  resultBadge: app.querySelector<HTMLElement>('#resultBadge')!,
  resultReason: app.querySelector<HTMLElement>('#resultReason')!,
  resultDetail: app.querySelector<HTMLElement>('#resultDetail')!,
  resultPrimary: app.querySelector<HTMLButtonElement>('#resultPrimary')!,
  resultSecondary: app.querySelector<HTMLButtonElement>('#resultSecondary')!,
}

function makeId() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `session-${Math.random().toString(16).slice(2)}-${Date.now().toString(16)}`
}

function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function pick<T>(random: () => number, values: T[]) {
  return values[Math.floor(random() * values.length)]
}

function generatePrediction(seed: number): Prediction {
  const random = mulberry32(seed)
  const titles = [
    'Shift Lead of the Fry Dimension',
    'Senior Packet Wrangler',
    'Director of Grease Logistics',
    'Apprentice Combo Architect',
    'Regional Cheese-Drizzle Coordinator',
  ]
  const badges = [
    'Certified Bag of Fries Energy',
    'Sauce Packet Visionary',
    'Golden Arches Adjacent',
    'Mandatory Apron Enthusiast',
    'One Thousand Yard Stare, but make it serviceable',
  ]
  const subtleties = [
    'Your future self is clocking in by 6:12 p.m. with a clipboard and a suspiciously optimistic smile.',
    'A manager named Dee will trust you with the headset before you even learn the nugget count.',
    'You will develop a sixth sense for fries, trays, and the exact moment a customer wants extra ketchup.',
    'Your phone battery dies at the same moment your career in heated oil begins.',
    'The prophecy has checked your screen time and decided you are ready for apron-based leadership.',
  ]
  const details = [
    'You will fold bags with the precision of a clouded mathematician and the confidence of someone who has never seen daylight in the break room.',
    'The fryer will call to you. You will answer with a nod, a timer beep, and a deeply competent handoff of curly fries.',
    'By Thursday, you will say “order up” like it is a family tradition and own a visor with unearned authority.',
    'Your destiny includes a heroic amount of napkins, two accidental compliments, and one deeply cursed drive-thru slogan.',
    'A stranger will ask for a “little extra salt” and you will respond with the calm of a person who has seen everything.',
  ]
  const reasons = [
    'the reels went silent for 8.0s',
    'your thumb stopped doomscrolling',
    'the fryer clock caught you daydreaming',
    'the algorithm lost your attention to destiny',
    'your screen time entered management training',
  ]

  return {
    title: pick(random, titles),
    subtitle: pick(random, subtleties),
    summary: pick(random, details),
    detail: pick(random, details),
    badge: pick(random, badges),
    cause: pick(random, reasons),
  }
}

function blankPrediction(): Prediction {
  return {
    title: 'Awaiting the fryer’s verdict.',
    subtitle: 'The machine is listening for your thumb to stop moving.',
    summary: 'No prediction yet.',
    detail: 'Start a session to see your absurd culinary future.',
    badge: 'No fate assigned',
    cause: 'no session armed',
  }
}

function loadState(): SessionState {
  const fallback: SessionState = {
    armed: false,
    phase: 'intro',
    sessionId: '',
    seed: 0,
    startedAt: 0,
    lastActivityAt: 0,
    activityCount: 0,
    scrollCount: 0,
    lastInput: 'none',
    prediction: blankPrediction(),
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return fallback

    const parsed = JSON.parse(raw) as Partial<SessionState>
    return {
      armed: Boolean(parsed.armed),
      phase: parsed.phase ?? 'intro',
      sessionId: parsed.sessionId ?? '',
      seed: parsed.seed ?? 0,
      startedAt: parsed.startedAt ?? 0,
      lastActivityAt: parsed.lastActivityAt ?? 0,
      activityCount: parsed.activityCount ?? 0,
      scrollCount: parsed.scrollCount ?? 0,
      lastInput: parsed.lastInput ?? 'none',
      prediction: parsed.prediction ?? blankPrediction(),
    }
  } catch {
    return fallback
  }
}

let state = loadState()
state = reconcileState(state)
let saveTimeout: number | undefined

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // localStorage may be unavailable; the experience still works.
  }
}

function queueSave() {
  window.clearTimeout(saveTimeout)
  saveTimeout = window.setTimeout(() => {
    saveTimeout = undefined
    saveState()
  }, 180)
}

function phaseLabel(phase: Phase) {
  switch (phase) {
    case 'active':
      return 'Active'
    case 'warning':
      return 'Warning'
    case 'predicting':
      return 'Predicting'
    case 'result':
      return 'Result'
    case 'intro':
    default:
      return 'Dormant'
  }
}

function reconcileState(next: SessionState): SessionState {
  if (!next.armed) {
    next.phase = 'intro'
    return next
  }

  if (!next.seed) {
    next.seed = Math.floor(Math.random() * 1_000_000_000)
  }

  if (!next.prediction?.title) {
    next.prediction = generatePrediction(next.seed)
  }

  if (!next.sessionId) next.sessionId = makeId()
  if (!next.startedAt) next.startedAt = now
  if (!next.lastActivityAt) next.lastActivityAt = next.startedAt

  next.phase = derivePhase(next, Date.now())
  return next
}

function derivePhase(current: SessionState, time = Date.now()): Phase {
  if (!current.armed) return 'intro'
  if (current.phase === 'result') return 'result'

  const idle = time - current.lastActivityAt
  if (idle >= RESULT_MS) return 'result'
  if (idle >= PREDICTING_MS) return 'predicting'
  if (idle >= WARNING_MS) return 'warning'
  return 'active'
}

function formatSeconds(ms: number) {
  return `${(ms / 1000).toFixed(1)}s`
}

function formatSessionId(id: string) {
  return id ? id.slice(-6).toUpperCase() : '—'
}

function currentIdleMs(time = Date.now()) {
  return state.armed ? Math.max(0, time - state.lastActivityAt) : 0
}

function isControlTarget(target: EventTarget | null) {
  return target instanceof Element && target.closest('button') !== null
}

function startSession() {
  const startedAt = Date.now()
  const seed = Math.floor(Math.random() * 1_000_000_000)

  state = {
    armed: true,
    phase: 'active',
    sessionId: makeId(),
    seed,
    startedAt,
    lastActivityAt: startedAt,
    activityCount: 0,
    scrollCount: 0,
    lastInput: 'none',
    prediction: generatePrediction(seed),
  }

  saveState()
  render()
}

function resetSession() {
  state = {
    armed: false,
    phase: 'intro',
    sessionId: '',
    seed: 0,
    startedAt: 0,
    lastActivityAt: 0,
    activityCount: 0,
    scrollCount: 0,
    lastInput: 'none',
    prediction: blankPrediction(),
  }

  saveState()
  render()
}

function fastForward() {
  if (!state.armed) {
    startSession()
  }

  state.lastActivityAt = Date.now() - RESULT_MS - 500
  state.phase = 'predicting'
  state.activityCount += 1
  state.lastInput = 'demo'
  saveState()
  render()
}

function noteActivity(kind: InputKind) {
  if (!state.armed) return
  if (state.phase === 'result') return

  state.activityCount += 1
  state.lastInput = kind
  state.lastActivityAt = Date.now()
  if (kind === 'scroll') state.scrollCount += 1
  state.phase = 'active'
  queueSave()
  render()
}

function render() {
  const time = Date.now()
  const previousPhase = state.phase
  const phase = derivePhase(state, time)
  if (phase !== state.phase) {
    state.phase = phase
    if (phase === 'result') saveState()
  }

  const idle = currentIdleMs(time)
  const progress = state.armed
    ? Math.min(1, idle / RESULT_MS)
    : 0
  const heat = Math.round(progress * 100)
  const toWarning = Math.max(0, WARNING_MS - idle)
  const toResult = Math.max(0, RESULT_MS - idle)

  els.shell.dataset.phase = phase
  document.title =
    phase === 'result'
      ? `ForkOrFry — ${state.prediction.title}`
      : `ForkOrFry — ${phaseLabel(phase)}`

  els.phasePill.textContent = phaseLabel(phase)
  els.stateWord.textContent = phaseLabel(phase)
  els.primaryCta.textContent =
    phase === 'result' ? 'Roll again' : state.armed ? 'Keep scrolling' : 'Start scrolling'
  els.secondaryCta.textContent = phase === 'result' ? 'Close the fryer' : 'Fast-forward demo'

  els.headline.textContent =
    phase === 'result' ? state.prediction.title : 'Your next career move is one reel away from the fries station.'
  els.lede.textContent =
    phase === 'result'
      ? state.prediction.subtitle
      : 'Tap start, let the feed go quiet, and ForkOrFry will escalate from a light warning to a completely unhinged fast-food forecast.'

  els.meterLabel.textContent = `${heat}%`
  els.meterFill.style.width = `${heat}%`
  els.meterCopy.textContent =
    phase === 'active'
      ? `You are safe for ${formatSeconds(toWarning)} more. The feed is still arguing with itself.`
      : phase === 'warning'
        ? `Result in ${formatSeconds(toResult)}. The fryer smells a lack of movement.`
        : phase === 'predicting'
          ? `Prediction sequence live. Result in ${formatSeconds(toResult)}.`
          : phase === 'result'
            ? 'Result stabilized. The bag is in your hands now.'
            : 'Waiting for you to open the reels.'

  els.diagSession.textContent = formatSessionId(state.sessionId)
  els.diagIdle.textContent = state.armed ? formatSeconds(idle) : '0.0s'
  els.diagInput.textContent = state.lastInput
  els.diagScrolls.textContent = `${state.scrollCount}`
  els.diagActivity.textContent = `${state.activityCount}`
  els.diagThreshold.textContent =
    phase === 'result'
      ? 'future delivered'
      : phase === 'predicting'
        ? `result in ${formatSeconds(RESULT_MS - PREDICTING_MS)}`
        : `warning at ${formatSeconds(WARNING_MS)} / result at ${formatSeconds(RESULT_MS)}`

  els.diagnosticHeadline.textContent =
    phase === 'result'
      ? 'Forecast sealed.'
      : phase === 'predicting'
        ? 'The app is compiling a deeply unserious destiny.'
        : phase === 'warning'
          ? 'Stand still a little longer. We dare you.'
          : state.armed
            ? 'The feed is open and the fryer is listening.'
            : 'No doomscroll detected yet.'
  els.diagnosticBody.textContent =
    phase === 'result'
      ? `Final reading: ${state.prediction.cause}. ${state.prediction.summary}`
      : phase === 'predicting'
        ? 'The future is currently being ladled into a paper tray.'
        : phase === 'warning'
          ? 'A dramatic pause has been noted. The manager in the sky is taking attendance.'
          : state.armed
            ? 'Keep interacting if you want to stay “active”; stop and the simulator will judge you.'
            : 'Press start to begin the countdown to your apron-era destiny.'

  els.resultOverlay.hidden = phase !== 'result'
  els.resultTitle.textContent = state.prediction.title
  els.resultSubtitle.textContent = state.prediction.subtitle
  els.resultBadge.textContent = state.prediction.badge
  els.resultReason.textContent = phase === 'result' ? state.prediction.cause : 'not ready yet'
  els.resultDetail.textContent = state.prediction.detail

  if (phase === 'result' && previousPhase !== 'result') {
    els.resultPrimary.focus()
  }
}

els.primaryCta.addEventListener('click', () => {
  if (state.phase === 'result') {
    startSession()
    return
  }

  if (!state.armed) {
    startSession()
    return
  }

  noteActivity('pointer')
})

els.secondaryCta.addEventListener('click', () => {
  if (state.phase === 'result') {
    resetSession()
    return
  }

  fastForward()
})

els.resultPrimary.addEventListener('click', startSession)
els.resultSecondary.addEventListener('click', resetSession)

window.addEventListener(
  'pointerdown',
  (event) => {
    if (isControlTarget(event.target)) return
    noteActivity('pointer')
  },
  { passive: true },
)
window.addEventListener('keydown', (event) => {
  if (isControlTarget(event.target)) return
  noteActivity('key')
})
window.addEventListener(
  'touchstart',
  (event) => {
    if (isControlTarget(event.target)) return
    noteActivity('touch')
  },
  { passive: true },
)
window.addEventListener('focus', () => noteActivity('focus'))
window.addEventListener(
  'scroll',
  () => {
    if (!state.armed || state.phase === 'result') return
    noteActivity('scroll')
  },
  { passive: true },
)
window.addEventListener('pagehide', saveState)

setInterval(render, 180)
render()
