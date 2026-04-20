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
    <p class="lede">Fake-only. Local-only. No real cursor, no real site, no submission.</p>
  </header>
  <section class="card stage" id="stage"></section>
  <div class="actions">
    <button type="button" id="reset">Reset</button>
    <button type="button" id="dismiss">Dismiss takeover</button>
  </div>
</main>`

const cursor = app.querySelector<HTMLElement>('#cursor')!
const stage = app.querySelector<HTMLElement>('#stage')!
const dismissButton = app.querySelector<HTMLButtonElement>('#dismiss')
const resetButton = app.querySelector<HTMLButtonElement>('#reset')

stage.innerHTML = `
  <div class="line">Welcome to <strong>ForkOrFry</strong>, the very fake crew-only onboarding flow.</div>
  <div class="field"><label>Employee alias</label><div class="input" data-fill></div></div>
  <div class="field"><label>Shift vibe</label><div class="input" data-fill></div></div>
  <div class="field"><label>Sauce alignment</label><div class="input" data-fill></div></div>
  <div class="field"><label>Bagging confidence</label><div class="input" data-fill></div></div>
  <div class="note">This page never submits anything and never talks to the network.</div>`

const fills = [...stage.querySelectorAll<HTMLElement>('[data-fill]')]
const aliases = ['Night Fry Ace', 'Combo Captain', 'Packet Wizard', 'Receipt Whisperer']
const vibes = ['extra crispy', 'mildly chaotic', 'manager-ready', 'suspiciously calm']
const sauces = ['sweet heat', 'tiny ketchup treaty', 'ultra ranch', 'confidential blend']
const confidence = ['90%', '97%', '100%', 'bag sealed']
const fillValues = [aliases[0], vibes[1], sauces[2], confidence[3]]

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

async function run() {
  await moveCursorToElement(stage.querySelector('.line') ?? stage)
  for (const [index, el] of fills.entries()) {
    await moveCursorToElement(el)
    await typeLine(el, fillValues[index] ?? 'queued')
    await sleep(420)
  }
  await moveCursorToElement(dismissButton ?? stage)
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
