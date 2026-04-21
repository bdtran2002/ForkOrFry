import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { basename, extname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const extensionRoot = resolve(fileURLToPath(new URL('..', import.meta.url)))
const defaultSourceDir = resolve(extensionRoot, '..', '.upstream-reference', 'hurrycurry', 'client', 'web-export')
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

const manifest = {
  htmlEntry: htmlEntries.includes('index.html') ? 'index.html' : htmlEntries[0],
  files,
  generatedAt: new Date().toISOString(),
  sourceDir,
}

writeFileSync(resolve(targetDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')

console.log(`Copied Godot web export from ${sourceDir} to ${targetDir}`)
console.log(`Manifest entrypoint: ${manifest.htmlEntry}`)
