import { mkdirSync, rmSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const extensionRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const repoRoot = resolve(extensionRoot, '..');
const distDir = resolve(extensionRoot, 'dist');
const bundlePath = resolve(distDir, 'forkorfry-source-bundle.zip');

const includeRoots = [
  'README.md',
  'LICENSE',
  'extension',
  'docs/amo',
];

mkdirSync(distDir, { recursive: true });
rmSync(bundlePath, { force: true });

const trackedFilesResult = spawnSync('git', ['ls-files', '--', ...includeRoots], {
  cwd: repoRoot,
  encoding: 'utf8',
});

if (trackedFilesResult.status !== 0) {
  process.exit(trackedFilesResult.status ?? 1);
}

const trackedFiles = trackedFilesResult.stdout
  .split('\n')
  .map((line) => line.trim())
  .filter(Boolean)
  .filter((filePath) => !filePath.startsWith('extension/dist/') && !filePath.startsWith('extension/.wxt/'));

const result = spawnSync('zip', ['-r', bundlePath, ...trackedFiles], { cwd: repoRoot, stdio: 'inherit' });

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

try {
  const size = statSync(bundlePath).size;
  console.log(`Created ${bundlePath} (${size} bytes)`);
} catch {
  console.log(`Created ${bundlePath}`);
}
