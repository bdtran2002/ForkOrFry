import '../../style.css'
import {
  type HostToRuntimeMessage,
  isHostToRuntimeMessage,
  type RuntimeCheckpointEnvelope,
  type RuntimeStatusPhase,
  type RuntimeToHostMessage,
} from '../runtime-host/contract'
import {
  createBridgeBootstrapMessage,
  createBridgePauseMessage,
  createBridgeResumeMessage,
  isUpstreamEmbeddedToParentMessage,
} from './upstream-bridge'
import { createBurgersIncBootstrapTemplate } from '../../../upstream/generated/burgers-inc-bootstrap'
import { createUpstreamRuntimeCheckpoint, restoreUpstreamRuntimeCheckpoint } from './upstream-checkpoint'
import { upstreamRuntimeCopy } from './upstream-runtime-copy'
import { normalizeUpstreamExportManifest, resolveUpstreamExportUrl } from './upstream-export'
import { acknowledgeUpstreamBridgeSnapshot, createInitialUpstreamRuntimeState, describeUpstreamRuntimeSession, errorUpstreamBridgeSnapshot, isUpstreamRuntimeSessionReused, restoreUpstreamBridgeSnapshotForSession, summarizeUpstreamRuntimeGameplayPackets, trimUpstreamRuntimeGameplayPackets, type UpstreamRuntimeExportState, type UpstreamRuntimeState } from './upstream-runtime-state'

const RUNTIME_ID = 'burger-runtime'
const EXPORT_MANIFEST_PATH = '/upstream/hurrycurry-web/manifest.json'
const RUNTIME_CAPABILITIES = ['checkpoint', 'pause', 'resume', 'upstream-runtime-shell'] as const
const LOCAL_BOOTSTRAP_TEMPLATE = createBurgersIncBootstrapTemplate(1)

function createRuntimeBootstrapPayload(sessionId: string) {
  return {
    ...LOCAL_BOOTSTRAP_TEMPLATE,
    sessionId,
    generatedAt: new Date().toISOString(),
  }
}

const app = document.querySelector<HTMLDivElement>('#app')

if (!app) throw new Error('Missing runtime frame root')

app.innerHTML = `
<main class="takeover runtime-frame-shell">
  <section class="card stage">
    <header>
      <h2>Runtime host</h2>
    </header>
    <div class="status-row">
      <div>
        <p class="eyebrow compact">Host status</p>
        <div class="status-text" id="status-text">Waiting for startup…</div>
      </div>
      <div class="stage-pill" id="stage-pill"></div>
    </div>
    <div class="shell-grid">
      <div class="field"><label>${upstreamRuntimeCopy.labels.exportState}</label><div class="input" id="export-state-value"></div></div>
      <div class="field"><label>${upstreamRuntimeCopy.labels.bridgeState}</label><div class="input" id="bridge-state-value"></div></div>
      <div class="field"><label>${upstreamRuntimeCopy.labels.session}</label><div class="input" id="session-value"></div></div>
      <div class="field"><label>${upstreamRuntimeCopy.labels.exportPath}</label><div class="input" id="export-path-value"></div></div>
      <div class="field"><label>${upstreamRuntimeCopy.labels.checkpoint}</label><div class="input" id="checkpoint-value"></div></div>
      <div class="field"><label>${upstreamRuntimeCopy.labels.gameplayPackets}</label><div class="input" id="gameplay-packets-value"></div></div>
      <div class="field"><label>${upstreamRuntimeCopy.labels.gameplaySummary}</label><div class="input" id="gameplay-summary-value"></div></div>
    </div>
    <div class="actions runtime-controls">
      <button type="button" class="secondary" id="refresh-export">Refresh export</button>
    </div>
    <div class="completion" id="export-message">
      <div class="completion-badge">Export status</div>
      <p id="export-message-body"></p>
    </div>
    <div class="runtime-embed" id="runtime-embed" hidden>
      <iframe class="runtime-embed-frame" id="runtime-embed-frame" title="Bundled Hurry Curry runtime" sandbox="allow-scripts allow-same-origin allow-pointer-lock allow-downloads"></iframe>
      <div class="runtime-embed-overlay" id="runtime-embed-overlay" hidden>Paused by the extension host</div>
    </div>
  </section>
</main>`

const statusText = app.querySelector<HTMLElement>('#status-text')!
const stagePill = app.querySelector<HTMLElement>('#stage-pill')!
const exportStateValue = app.querySelector<HTMLElement>('#export-state-value')!
const bridgeStateValue = app.querySelector<HTMLElement>('#bridge-state-value')!
const sessionValue = app.querySelector<HTMLElement>('#session-value')!
const exportPathValue = app.querySelector<HTMLElement>('#export-path-value')!
const checkpointValue = app.querySelector<HTMLElement>('#checkpoint-value')!
const gameplayPacketsValue = app.querySelector<HTMLElement>('#gameplay-packets-value')!
const gameplaySummaryValue = app.querySelector<HTMLElement>('#gameplay-summary-value')!
const exportMessageBody = app.querySelector<HTMLElement>('#export-message-body')!
const refreshButton = app.querySelector<HTMLButtonElement>('#refresh-export')!
const runtimeEmbed = app.querySelector<HTMLElement>('#runtime-embed')!
const runtimeEmbedFrame = app.querySelector<HTMLIFrameElement>('#runtime-embed-frame')!
const runtimeEmbedOverlay = app.querySelector<HTMLElement>('#runtime-embed-overlay')!

let state: UpstreamRuntimeState = createInitialUpstreamRuntimeState()
let godotBridgePollHandle: number | null = null

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

function postCheckpoint(reason?: string) {
  if (reason) {
    state = { ...state, lastCheckpointReason: reason }
    render()
  }

  postToHost({
    type: 'runtime:checkpoint',
    runtimeId: RUNTIME_ID,
    checkpoint: createUpstreamRuntimeCheckpoint(RUNTIME_ID, state),
  })
}

function setState(nextState: Partial<UpstreamRuntimeState>) {
  state = { ...state, ...nextState }
  render()
}

function currentPhaseDetail() {
  return state.detail
}

function renderEmbed() {
  const hasExport = Boolean(state.exportUrl)
  runtimeEmbed.hidden = !hasExport
  if (hasExport && runtimeEmbedFrame.src !== state.exportUrl) {
    runtimeEmbedFrame.src = state.exportUrl!
  }
  if (!hasExport && runtimeEmbedFrame.getAttribute('src')) {
    runtimeEmbedFrame.removeAttribute('src')
  }
  runtimeEmbedOverlay.hidden = state.phase !== 'paused'
}

function renderMessage() {
  switch (state.exportState) {
    case 'missing':
      exportMessageBody.textContent = upstreamRuntimeCopy.missingSummary
      return
    case 'error':
      exportMessageBody.textContent = upstreamRuntimeCopy.errorSummary(state.detail)
      return
    case 'ready':
      exportMessageBody.textContent = state.exportUrl
        ? upstreamRuntimeCopy.readySummary(state.exportUrl)
        : upstreamRuntimeCopy.exportStates.ready
      return
    case 'loaded':
      exportMessageBody.textContent = upstreamRuntimeCopy.loadedSummary
      return
    default:
      exportMessageBody.textContent = upstreamRuntimeCopy.exportStates.unknown
  }
}

function render() {
  statusText.textContent = upstreamRuntimeCopy.phaseLabels[state.phase]
  stagePill.textContent = state.phase
  exportStateValue.textContent = upstreamRuntimeCopy.exportStates[state.exportState as UpstreamRuntimeExportState]
  bridgeStateValue.textContent = upstreamRuntimeCopy.bridgeStates[state.bridgeState]
  sessionValue.textContent = state.sessionId ? state.sessionId.slice(0, 12) : 'No session yet'
  exportPathValue.textContent = state.exportUrl ?? EXPORT_MANIFEST_PATH
  checkpointValue.textContent = upstreamRuntimeCopy.checkpointSummary(state.lastCheckpointReason)
  gameplayPacketsValue.textContent = upstreamRuntimeCopy.gameplayPacketsSummary(state.gameplayPackets)
  gameplaySummaryValue.textContent = upstreamRuntimeCopy.gameplayPacketSummary(state.gameplayPacketSummary)
  renderMessage()
  renderEmbed()
}

function clearGodotBridgePoll() {
  if (godotBridgePollHandle !== null) {
    window.clearInterval(godotBridgePollHandle)
    godotBridgePollHandle = null
  }
}

function postToEmbeddedRuntime(message: unknown) {
  runtimeEmbedFrame.contentWindow?.postMessage(message, window.location.origin)
}

function recordGameplayPacket(action: 'movement' | 'interact' | 'ready' | 'idle', payload: Record<string, unknown>) {
  const packet = { action, payload, receivedAt: new Date().toISOString() }
  const gameplayPackets = trimUpstreamRuntimeGameplayPackets([...state.gameplayPackets, packet])
  setState({
    gameplayPackets,
    gameplayPacketSummary: summarizeUpstreamRuntimeGameplayPackets(gameplayPackets),
  })
  postCheckpoint(`Received outbound gameplay packet: ${action}.`)
}

function sendBootstrapToEmbeddedRuntime(messageType: 'bootstrap' | 'resume') {
  if (!state.sessionId || !runtimeEmbedFrame.contentWindow) return
  const payload = createRuntimeBootstrapPayload(state.sessionId)

  postToEmbeddedRuntime(
    messageType === 'resume'
      ? createBridgeResumeMessage(payload)
      : createBridgeBootstrapMessage(payload),
  )

  setState({
    bridgeState: 'sent',
    detail: `Sent ${payload.packets.length} local bootstrap packets to the embedded runtime.`,
  })
  postStatus(state.phase, currentPhaseDetail())
}

async function loadBundledExport() {
  setState({ exportState: 'unknown', detail: upstreamRuntimeCopy.exportStates.unknown })

  try {
    const response = await fetch(EXPORT_MANIFEST_PATH, { cache: 'no-store' })
    if (!response.ok) {
      clearGodotBridgePoll()
      setState({
        exportState: 'missing',
        phase: 'ready',
        exportUrl: null,
        detail: upstreamRuntimeCopy.exportStates.missing,
      })
      postStatus('ready', currentPhaseDetail())
      return
    }

    const manifest = normalizeUpstreamExportManifest(await response.json())
    if (!manifest) {
      clearGodotBridgePoll()
      setState({
        exportState: 'error',
        phase: 'ready',
        exportUrl: null,
        detail: 'manifest.json exists but is not valid for the runtime.',
      })
      postStatus('ready', currentPhaseDetail())
      return
    }

    const exportUrl = resolveUpstreamExportUrl(manifest)
    setState({
      exportState: 'ready',
      phase: state.phase === 'paused' ? 'paused' : 'running',
      exportUrl,
      detail: upstreamRuntimeCopy.readySummary(exportUrl),
    })
    postStatus(state.phase === 'paused' ? 'paused' : 'running', currentPhaseDetail())
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Unknown export-loading error.'
    clearGodotBridgePoll()
    setState({
      exportState: 'error',
      phase: 'ready',
      exportUrl: null,
      detail,
    })
    postStatus('ready', currentPhaseDetail())
  }
}

function boot(checkpoint: RuntimeCheckpointEnvelope | null, nextSessionId: string) {
  const restored = restoreUpstreamRuntimeCheckpoint(RUNTIME_ID, checkpoint)
  const bootstrapPayload = createRuntimeBootstrapPayload(nextSessionId)
  const reused = isUpstreamRuntimeSessionReused(restored.bridgeSnapshot, nextSessionId)

  state = {
    ...restored,
    sessionId: nextSessionId,
    phase: 'booting',
    bridgeState: 'waiting',
    bootstrapPacketCount: bootstrapPayload.packets.length,
    bridgeSnapshot: restoreUpstreamBridgeSnapshotForSession(restored.bridgeSnapshot, nextSessionId),
    detail: describeUpstreamRuntimeSession(nextSessionId, reused),
  }
  render()
  postStatus('booting', currentPhaseDetail())
  postToHost({
    type: 'runtime:ready',
    runtimeId: RUNTIME_ID,
    capabilities: [...RUNTIME_CAPABILITIES],
  })
  postCheckpoint('Booted runtime shell.')
  void loadBundledExport()
}

function handleHostMessage(message: HostToRuntimeMessage) {
  switch (message.type) {
    case 'host:boot':
      boot(message.checkpoint, message.sessionId)
      return
    case 'host:pause':
      clearGodotBridgePoll()
      postToEmbeddedRuntime(createBridgePauseMessage(message.reason))
      setState({ phase: 'paused', detail: message.reason })
      postStatus('paused', currentPhaseDetail())
      postCheckpoint(message.reason)
      return
    case 'host:resume': {
      const restored = restoreUpstreamRuntimeCheckpoint(RUNTIME_ID, message.checkpoint)
      const sessionId = restored.sessionId || state.sessionId
      const reused = isUpstreamRuntimeSessionReused(restored.bridgeSnapshot, sessionId)
      state = {
        ...restored,
        sessionId,
        phase: restored.exportUrl ? 'running' : 'ready',
        bridgeState: restored.exportUrl ? 'waiting' : restored.bridgeState,
        bridgeSnapshot: restoreUpstreamBridgeSnapshotForSession(restored.bridgeSnapshot, sessionId),
        detail: reused
          ? describeUpstreamRuntimeSession(sessionId, true)
          : restored.exportUrl ? upstreamRuntimeCopy.phaseLabels.running : upstreamRuntimeCopy.phaseLabels.ready,
      }
      render()
      sendBootstrapToEmbeddedRuntime('resume')
      postStatus(state.phase, currentPhaseDetail())
      postCheckpoint('Resumed runtime shell.')
      return
    }
    case 'host:checkpoint':
      postCheckpoint(message.reason)
      return
    case 'host:shutdown':
      clearGodotBridgePoll()
      postCheckpoint('Host requested shutdown.')
  }
}

refreshButton.addEventListener('click', () => {
  void loadBundledExport()
})

runtimeEmbedFrame.addEventListener('load', () => {
  if (!state.exportUrl || state.phase === 'paused') return
  setState({ exportState: 'loaded', phase: 'running', detail: upstreamRuntimeCopy.loadedSummary })
  sendBootstrapToEmbeddedRuntime('bootstrap')
  postStatus('running', currentPhaseDetail())
  postCheckpoint('Bundled export iframe loaded.')
})

window.addEventListener('message', (event) => {
  if (event.origin !== window.location.origin) return

  if (event.source === window.parent) {
    if (!isHostToRuntimeMessage(event.data)) return
    if ('runtimeId' in event.data && event.data.runtimeId !== RUNTIME_ID) return
    handleHostMessage(event.data)
    return
  }

  const embeddedMessage = event.data
  if (event.source === runtimeEmbedFrame.contentWindow && isUpstreamEmbeddedToParentMessage(embeddedMessage)) {
    switch (embeddedMessage.type) {
      case 'forkorfry:bridge-ready':
        setState({ bridgeState: 'waiting', detail: 'Bridge is ready for bootstrap data.' })
        sendBootstrapToEmbeddedRuntime('bootstrap')
        return
      case 'forkorfry:bridge-bootstrap-ack':
        setState({
          bridgeState: 'acknowledged',
          bridgeSnapshot: acknowledgeUpstreamBridgeSnapshot(state.bridgeSnapshot, embeddedMessage.sessionId, embeddedMessage.packetCount),
          detail: `Runtime acknowledged ${embeddedMessage.packetCount} bootstrap packets.`,
        })
        postStatus(state.phase, currentPhaseDetail())
        postCheckpoint('Runtime acknowledged bootstrap payload.')
        return
      case 'forkorfry:bridge-error':
        setState({
          bridgeState: 'error',
          bridgeSnapshot: errorUpstreamBridgeSnapshot(state.bridgeSnapshot, embeddedMessage.detail),
          detail: embeddedMessage.detail,
        })
        postStatus(state.phase, currentPhaseDetail())
        return
      case 'forkorfry:bridge-gameplay-packet':
        recordGameplayPacket(embeddedMessage.action, embeddedMessage.payload)
        return
    }
  }
})

document.addEventListener('visibilitychange', () => {
  if (!document.hidden) return
  postCheckpoint('Runtime frame hidden.')
})

window.addEventListener('pagehide', () => {
  clearGodotBridgePoll()
  postCheckpoint('Runtime frame unloading.')
})

render()
