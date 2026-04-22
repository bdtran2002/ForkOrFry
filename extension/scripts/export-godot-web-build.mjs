import { existsSync, mkdirSync, statSync } from 'node:fs'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const extensionRoot = resolve(fileURLToPath(new URL('..', import.meta.url)))
const repoRoot = resolve(extensionRoot, '..')
const sourceDir = resolve(repoRoot, '.upstream-reference', 'hurrycurry', 'client')
const overlayDir = resolve(extensionRoot, 'upstream', 'hurrycurry-client-overlay')
const syncScriptPath = resolve(extensionRoot, 'scripts', 'sync-godot-web-export.mjs')

const godotBinary = process.env.GODOT_BIN || '/Applications/Godot.app/Contents/MacOS/Godot'
const exportPreset = process.env.GODOT_EXPORT_PRESET || 'wasm32-unknown-unknown'

function fail(message) {
  console.error(`export-godot-web-build: ${message}`)
  process.exit(1)
}

function ensureDirectory(path, label) {
  if (!existsSync(path) || !statSync(path).isDirectory()) {
    fail(`${label} not found: ${path}`)
  }
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    ...options,
  })

  if (result.status !== 0) {
    fail(`${command} exited with status ${result.status ?? 'unknown'}`)
  }
}

ensureDirectory(sourceDir, 'upstream client source')
ensureDirectory(overlayDir, 'overlay directory')

if (!existsSync(godotBinary)) {
  fail(`Godot binary not found: ${godotBinary}`)
}

const workdir = mkdtempSync(resolve(tmpdir(), 'forkorfry-godot-client-'))
const projectDir = resolve(workdir, 'client')
const outDir = resolve(workdir, 'web-export')

mkdirSync(outDir, { recursive: true })

run('/bin/cp', ['-R', sourceDir, projectDir])
run('/bin/chmod', ['-R', 'u+w', projectDir])
run('/usr/bin/ditto', [overlayDir, projectDir])

const outputHtml = resolve(outDir, 'index.html')

run(godotBinary, ['--headless', '--path', projectDir, '--export-release', exportPreset, outputHtml])
run(process.execPath, [syncScriptPath, outDir], { cwd: extensionRoot })

console.log(`Prepared Godot workdir: ${projectDir}`)
console.log(`Exported web build: ${outDir}`)
