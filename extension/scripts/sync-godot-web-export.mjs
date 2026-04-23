import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { basename, extname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const extensionRoot = resolve(fileURLToPath(new URL('..', import.meta.url)))
const defaultSourceDir = resolve(extensionRoot, '..', 'upstream-reference', 'hurrycurry', 'client', 'web-export')
const sourceDirArg = process.argv[2]?.trim()
const sourceDir = resolve(sourceDirArg || process.env.UPSTREAM_GODOT_WEB_EXPORT_DIR || defaultSourceDir)
const targetDir = resolve(extensionRoot, 'public', 'upstream', 'hurrycurry-web')

function fail(message) {
  console.error(`sync-godot-web-export: ${message}`)
  process.exit(1)
}

function listFiles(rootDir, currentDir = rootDir) {
  const entries = readdirSync(currentDir, { withFileTypes: true })
  return entries.flatMap((entry) => {
    const absolutePath = resolve(currentDir, entry.name)
    if (entry.isDirectory()) return listFiles(rootDir, absolutePath)
    if (!entry.isFile()) return []
    return [relative(rootDir, absolutePath).replaceAll('\\', '/')]
  })
}

function bridgeShim() {
  return `<script>
(function () {
  const PROTOCOL_VERSION = 1;
  const bridgeState = {
    version: PROTOCOL_VERSION,
    status: 'booting',
    paused: false,
    payload: null,
    lastError: null,
    lastPauseReason: null,
    lastEventAt: null,
  };

  function publishBridgeState() {
    bridgeState.lastEventAt = new Date().toISOString();
    window.__FORKORFRY_BRIDGE__ = bridgeState;
    window.__FORKORFRY_BOOT__ = bridgeState.payload;
  }

  function postToParent(type, extra) {
    if (window.parent === window) return;
    window.parent.postMessage({ type, version: PROTOCOL_VERSION, ...(extra || {}) }, window.location.origin);
  }

  function isBootstrapPayload(value) {
    return value && typeof value === 'object' && value.type === 'forkorfry:local-bootstrap' && typeof value.sessionId === 'string' && Array.isArray(value.packets);
  }

  window.addEventListener('message', (event) => {
    if (event.origin !== window.location.origin || event.source !== window.parent) return;

    const data = event.data;
    if (!data || typeof data !== 'object' || data.version !== PROTOCOL_VERSION || typeof data.type !== 'string') return;

    switch (data.type) {
      case 'forkorfry:bridge-bootstrap':
      case 'forkorfry:bridge-resume': {
        if (!isBootstrapPayload(data.payload)) {
          bridgeState.status = 'error';
          bridgeState.lastError = 'Invalid bootstrap payload.';
          publishBridgeState();
          postToParent('forkorfry:bridge-error', { detail: bridgeState.lastError });
          return;
        }

        bridgeState.status = 'running';
        bridgeState.paused = false;
        bridgeState.payload = data.payload;
        bridgeState.lastError = null;
        bridgeState.lastPauseReason = null;
        publishBridgeState();
        postToParent('forkorfry:bridge-bootstrap-ack', {
          sessionId: data.payload.sessionId,
          packetCount: data.payload.packets.length,
        });
        return;
      }
      case 'forkorfry:bridge-pause':
        bridgeState.status = 'paused';
        bridgeState.paused = true;
        bridgeState.lastPauseReason = typeof data.reason === 'string' ? data.reason : 'Paused by the extension host.';
        publishBridgeState();
        return;
      default:
        return;
    }
  });

  publishBridgeState();
  window.addEventListener('load', () => {
    postToParent('forkorfry:bridge-ready');
  });
}());
</script>`
}

function patchHtmlEntry(filePath) {
  const html = readFileSync(filePath, 'utf8')
  if (html.includes('__FORKORFRY_BRIDGE__')) return

  const scriptTag = '<script src="index.js"></script>'
  if (!html.includes(scriptTag)) {
    fail(`could not locate index.js script tag in ${filePath}`)
  }

  const patched = html.replace(scriptTag, `${scriptTag}\n\t\t${bridgeShim()}`)
  writeFileSync(filePath, patched, 'utf8')
}

if (!existsSync(sourceDir) || !statSync(sourceDir).isDirectory()) {
  fail(`export directory not found: ${sourceDir}`)
}

const files = listFiles(sourceDir).filter((file) => file !== 'manifest.json')
const htmlEntries = files.filter((file) => extname(file) === '.html')

if (htmlEntries.length === 0) {
  fail(`no .html entrypoint found in ${sourceDir}`)
}

mkdirSync(targetDir, { recursive: true })

for (const entry of readdirSync(targetDir, { withFileTypes: true })) {
  if (entry.name === 'README.md') continue
  rmSync(resolve(targetDir, entry.name), { recursive: true, force: true })
}

cpSync(sourceDir, targetDir, {
  recursive: true,
  force: true,
  filter: (sourcePath) => basename(sourcePath) !== 'manifest.json',
})

const htmlEntry = htmlEntries.includes('index.html') ? 'index.html' : htmlEntries[0]
patchHtmlEntry(resolve(targetDir, htmlEntry))

const manifest = {
  htmlEntry,
  files,
  generatedAt: new Date().toISOString(),
  sourceDir,
}

writeFileSync(resolve(targetDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')

console.log(`Copied Godot web export from ${sourceDir} to ${targetDir}`)
console.log(`Manifest entrypoint: ${manifest.htmlEntry}`)
