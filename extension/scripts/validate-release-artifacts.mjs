import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const extensionRoot = resolve(fileURLToPath(new URL('..', import.meta.url)))
const repoRoot = resolve(extensionRoot, '..')
const distDir = resolve(extensionRoot, 'dist')
const firefoxOutputDir = resolve(distDir, 'firefox-mv3')
const firefoxManifestPath = resolve(firefoxOutputDir, 'manifest.json')
const firefoxPackagePath = resolve(distDir, 'forkorfry-firefox-mv3.xpi')
const sourceBundlePath = resolve(distDir, 'forkorfry-source-bundle.zip')
const packageJsonPath = resolve(extensionRoot, 'package.json')
const reviewDocPath = 'extension/SOURCE_CODE_REVIEW.md'

const fail = (message) => {
  console.error(`Validation failed: ${message}`)
  process.exit(1)
}

if (!existsSync(firefoxOutputDir)) fail(`Firefox build output missing at ${firefoxOutputDir}`)
if (!existsSync(firefoxPackagePath)) fail(`Firefox package missing at ${firefoxPackagePath}`)
if (!existsSync(sourceBundlePath)) fail(`Source bundle missing at ${sourceBundlePath}`)

const manifest = JSON.parse(readFileSync(firefoxManifestPath, 'utf8'))
const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'))

if (manifest.version !== packageJson.version) {
  fail(`Manifest version ${manifest.version} does not match package.json version ${packageJson.version}`)
}

const expectedGeckoId = process.env.FORKORFRY_GECKO_ID?.trim()
if (expectedGeckoId) {
  const actualGeckoId = manifest.browser_specific_settings?.gecko?.id
  if (actualGeckoId !== expectedGeckoId) {
    fail(`Manifest gecko id ${actualGeckoId ?? '<missing>'} does not match FORKORFRY_GECKO_ID`)
  }
}

const bundleListing = spawnSync('unzip', ['-Z1', sourceBundlePath], {
  cwd: repoRoot,
  encoding: 'utf8',
})

if (bundleListing.status !== 0) {
  fail(`Unable to inspect source bundle at ${sourceBundlePath}`)
}

const entries = bundleListing.stdout.split('\n').map((line) => line.trim()).filter(Boolean)
if (!entries.includes(reviewDocPath)) {
  fail(`Source bundle is missing ${reviewDocPath}`)
}

console.log('Release artifacts validated successfully.')
