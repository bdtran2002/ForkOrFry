import '../../style.css'
import { type BackgroundMessage } from '../../core/messages'
import { type HostSurface } from '../../core/state'
import { createRuntimeHostController, type RuntimeMountRequest } from './controller'
import { runtimeHostCopy } from './copy'
import { type RuntimeHostSession } from './checkpoint-store'
import { DEFAULT_RUNTIME_DEFINITION } from './runtime-definition'

const app = document.querySelector<HTMLDivElement>('#app')

if (!app) throw new Error('Missing takeover root')

function getCurrentSurface(): HostSurface {
  const surface = new URLSearchParams(window.location.search).get('surface')
  return surface === 'full-tab' ? 'full-tab' : 'popup-window'
}

const currentSurface = getCurrentSurface()
const dismissLabel = currentSurface === 'full-tab'
  ? runtimeHostCopy.buttons.closeTab
  : runtimeHostCopy.buttons.closeWindow
const surfaceActionMarkup = currentSurface === 'popup-window'
  ? `<button type="button" class="secondary" id="open-full-tab">${runtimeHostCopy.buttons.openFullTab}</button>`
  : ''

app.innerHTML = `
<main class="takeover host-shell">
  <header>
    <p class="eyebrow">${runtimeHostCopy.eyebrow}</p>
    <div class="safety-banner">${runtimeHostCopy.banner}</div>
    <h1>${runtimeHostCopy.title}</h1>
    <p class="lede">${runtimeHostCopy.lede}</p>
  </header>
  <section class="card stage host-stage">
    <div class="status-grid host-status-grid" aria-label="Runtime host state">
      <div class="status-tile"><span class="status-label">${runtimeHostCopy.labels.status}</span><strong class="status-value" id="host-status"></strong></div>
      <div class="status-tile"><span class="status-label">${runtimeHostCopy.labels.surface}</span><strong class="status-value" id="host-surface"></strong></div>
      <div class="status-tile"><span class="status-label">${runtimeHostCopy.labels.runtime}</span><strong class="status-value" id="runtime-id"></strong></div>
      <div class="status-tile"><span class="status-label">${runtimeHostCopy.labels.session}</span><strong class="status-value" id="session-id"></strong></div>
      <div class="status-tile"><span class="status-label">${runtimeHostCopy.labels.resumeCount}</span><strong class="status-value" id="resume-count"></strong></div>
      <div class="status-tile host-status-wide"><span class="status-label">${runtimeHostCopy.labels.lastCheckpoint}</span><strong class="status-value" id="checkpoint-at"></strong></div>
    </div>
    <section class="runtime-shell">
      <div class="runtime-shell-header">
        <div>
          <p class="eyebrow compact">${runtimeHostCopy.runtimeCardTitle}</p>
          <p class="runtime-shell-copy">${runtimeHostCopy.runtimeCardBody}</p>
        </div>
      </div>
      <iframe id="runtime-frame" class="runtime-frame" title="ForkOrFry runtime frame"></iframe>
    </section>
    <div class="log-panel">
      <div class="log-title">${runtimeHostCopy.notesTitle}</div>
      <ul class="log-list">
        ${runtimeHostCopy.notes.map((note) => `<li>${note}</li>`).join('')}
      </ul>
    </div>
  </section>
  <div class="actions">
    ${surfaceActionMarkup}
    <button type="button" class="secondary" id="reset">${runtimeHostCopy.buttons.reset}</button>
    <button type="button" class="secondary" id="dismiss">${dismissLabel}</button>
  </div>
</main>`

const hostStatus = app.querySelector<HTMLElement>('#host-status')!
const hostSurfaceValue = app.querySelector<HTMLElement>('#host-surface')!
const runtimeIdValue = app.querySelector<HTMLElement>('#runtime-id')!
const sessionIdValue = app.querySelector<HTMLElement>('#session-id')!
const resumeCountValue = app.querySelector<HTMLElement>('#resume-count')!
const checkpointAtValue = app.querySelector<HTMLElement>('#checkpoint-at')!
const runtimeFrame = app.querySelector<HTMLIFrameElement>('#runtime-frame')!
const openFullTabButton = app.querySelector<HTMLButtonElement>('#open-full-tab')
const resetButton = app.querySelector<HTMLButtonElement>('#reset')
const dismissButton = app.querySelector<HTMLButtonElement>('#dismiss')

const runtimeUrl = browser.runtime.getURL(DEFAULT_RUNTIME_DEFINITION.entrypoint)

function formatTimestamp(value: number | null) {
  if (!value) return runtimeHostCopy.emptyCheckpoint

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value))
}

function shortSessionId(value: string) {
  return value ? value.slice(0, 8) : 'pending'
}

function renderSession(session: RuntimeHostSession) {
  hostStatus.textContent = session.detail ? `${session.status} — ${session.detail}` : session.status
  hostSurfaceValue.textContent = currentSurface === 'full-tab' ? runtimeHostCopy.surfaces.fullTab : runtimeHostCopy.surfaces.popupWindow
  runtimeIdValue.textContent = session.runtimeId
  sessionIdValue.textContent = shortSessionId(session.sessionId)
  resumeCountValue.textContent = String(session.resumeCount)
  checkpointAtValue.textContent = formatTimestamp(session.lastCheckpointAt)
}

async function mountRuntime({ reset }: RuntimeMountRequest) {
  return new Promise<{ frame: HTMLIFrameElement; runtimeWindow: Window }>((resolve, reject) => {
    const onLoad = () => {
      runtimeFrame.removeEventListener('load', onLoad)
      const runtimeWindow = runtimeFrame.contentWindow
      if (!runtimeWindow) {
        reject(new Error('Missing runtime frame window'))
        return
      }

      resolve({ frame: runtimeFrame, runtimeWindow })
    }

    runtimeFrame.addEventListener('load', onLoad)
    runtimeFrame.src = reset ? `${runtimeUrl}?t=${Date.now()}` : runtimeUrl
  })
}

const controller = createRuntimeHostController({
  runtimeId: DEFAULT_RUNTIME_DEFINITION.id,
  mountRuntime,
  onSessionChange: renderSession,
})

let hiddenPause = false
let closing = false
let transferring = false

openFullTabButton?.addEventListener('click', async () => {
  if (closing || transferring) return

  let pausedForTransfer = false
  transferring = true
  openFullTabButton.disabled = true

  try {
    await controller.pause('Moving session to the full-tab host.')
    pausedForTransfer = true
    await controller.requestCheckpoint('Finishing full-tab handoff.')
    await browser.runtime.sendMessage({ type: 'move-to-full-tab' } satisfies BackgroundMessage)
    closing = true
    await controller.shutdown()
    window.close()
  } catch (error) {
    console.error('Failed to move the runtime host into the full-tab surface.', error)

    if (pausedForTransfer && !closing) {
      await controller.resume()
    }

    transferring = false
    openFullTabButton.disabled = false
  }
})

resetButton?.addEventListener('click', async () => {
  await controller.reset()
})

dismissButton?.addEventListener('click', async () => {
  if (closing) return
  closing = true
  await controller.pause('Closing the current host surface.')
  await controller.shutdown()
  await browser.runtime.sendMessage({ type: 'close-surface' } satisfies BackgroundMessage)
  window.close()
})

window.addEventListener('keydown', async (event) => {
  if (event.key !== 'Escape') return
  dismissButton?.click()
})

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    hiddenPause = true
    void controller.pause('Host window hidden.')
    return
  }

  if (!hiddenPause) return
  hiddenPause = false
  void controller.resume()
})

window.addEventListener('pagehide', () => {
  if (closing) return
  controller.flushForPageHide('Host page unloading.')
})

void controller.start()
