import './style.css'

document.body.classList.add('takeover-mode')

const app = document.querySelector<HTMLDivElement>('#app')
if (!app) throw new Error('Missing takeover root')

app.innerHTML = `
<main class="takeover">
  <div class="cursor" id="cursor"></div>
  <header>
    <p class="eyebrow">ForkOrFry local parody</p>
    <div class="safety-banner">LOCAL DEMO · FAKE CURSOR · NO NETWORK · NO REAL SUBMISSION</div>
    <h1>Drive-thru destiny simulator</h1>
    <p class="lede">A playful, local-only onboarding loop that pretends to prep a crew member, then politely reveals it was theater all along.</p>
  </header>
  <section class="card stage" id="stage">
    <div class="status-row">
      <div>
        <p class="eyebrow compact">Session status</p>
        <div class="status-text" id="status-text">Booting fake onboarding...</div>
      </div>
      <div class="stage-pill" id="stage-pill">Step 1 of 5</div>
    </div>
    <div class="progress-track" aria-hidden="true"><div class="progress-fill" id="progress-fill"></div></div>
    <div class="stepper" id="stepper">
      <span>Briefing</span>
      <span>Profile</span>
      <span>Preferences</span>
      <span>Receipt</span>
      <span>Done</span>
    </div>
    <div class="log-panel">
      <div class="log-title">Fake activity log</div>
      <ul class="log-list" id="log-list"></ul>
    </div>
    <div class="form-grid" id="form-grid"></div>
    <div class="completion" id="completion" hidden>
      <div class="completion-badge">Simulation complete</div>
      <p>Nothing was submitted. Nothing left this tab. The onboarding storyline simply reached its tiny dramatic finale.</p>
    </div>
  </section>
  <div class="actions">
    <button type="button" id="reset">Reset</button>
    <button type="button" id="dismiss">Dismiss takeover</button>
  </div>
</main>`

const cursor = app.querySelector<HTMLElement>('#cursor')!
const formGrid = app.querySelector<HTMLElement>('#form-grid')!
const statusText = app.querySelector<HTMLElement>('#status-text')!
const stagePill = app.querySelector<HTMLElement>('#stage-pill')!
const progressFill = app.querySelector<HTMLElement>('#progress-fill')!
const stepper = app.querySelector<HTMLElement>('#stepper')!
const logList = app.querySelector<HTMLUListElement>('#log-list')!
const completion = app.querySelector<HTMLElement>('#completion')!
const dismissButton = app.querySelector<HTMLButtonElement>('#dismiss')
const resetButton = app.querySelector<HTMLButtonElement>('#reset')

const fields = [
  { label: 'Employee alias', value: 'Night Fry Ace' },
  { label: 'Shift vibe', value: 'mildly chaotic' },
  { label: 'Sauce alignment', value: 'ultra ranch' },
  { label: 'Bagging confidence', value: '100%'
  },
]

formGrid.innerHTML = fields
  .map((field) => `<div class="field"><label>${field.label}</label><div class="input" data-fill></div></div>`)
  .join('') + `<div class="note">This page never submits anything and never talks to the network.</div>`

const fills = [...formGrid.querySelectorAll<HTMLElement>('[data-fill]')]
const logs = [
  'Local session opened.',
  'Loaded fake crew profile template.',
  'Queued pretend preferences and badge colors.',
  'Verified nothing is being sent anywhere.',
  'Finalizing the theatrical checkout sequence.',
]

function sleep(ms: number) { return new Promise((resolve) => window.setTimeout(resolve, ms)) }
async function typeLine(el: HTMLElement, value: string) {
  el.textContent = ''
  for (const ch of value) { el.textContent += ch; await sleep(35) }
}

async function moveCursorToElement(el: Element) {
  const rect = el.getBoundingClientRect()
  const x = rect.left + rect.width / 2
  const y = rect.top + rect.height / 2
  cursor.style.transform = `translate(${x}px, ${y}px)`
  await sleep(220)
}

function setStep(index: number) {
  const step = Math.min(index + 1, 5)
  stagePill.textContent = `Step ${step} of 5`
  statusText.textContent = [
    'Booting fake onboarding...',
    'Collecting a delightfully fictional profile...',
    'Confirming pretend preferences...',
    'Reviewing the local-only receipt preview...',
    'Wrapping up the simulation with no side effects...',
  ][index] ?? 'Simulation complete.'
  progressFill.style.width = `${(step / 5) * 100}%`
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
  await sleep(500)
  await moveCursorToElement(formGrid)
  for (const [index, el] of fills.entries()) {
    setStep(Math.min(index + 1, 3))
    pushLog(logs[index + 1] ?? 'Advancing the fake flow.')
    await moveCursorToElement(el)
    await typeLine(el, fields[index]?.value ?? 'queued')
    await sleep(320)
  }
  setStep(4)
  pushLog(logs[4])
  completion.hidden = false
  await moveCursorToElement(completion)
  await sleep(300)
  stagePill.textContent = 'Complete'
  statusText.textContent = 'Simulation complete. Local-only and safely over the top.'
}

resetButton?.addEventListener('click', () => window.location.reload())
dismissButton?.addEventListener('click', async () => {
  await browser.runtime.sendMessage({ type: 'disarm' })
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
