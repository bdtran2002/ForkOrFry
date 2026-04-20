import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'wxt'

const extensionRoot = resolve(fileURLToPath(new URL('.', import.meta.url)))

const packageJson = JSON.parse(readFileSync(resolve(extensionRoot, 'package.json'), 'utf8')) as {
  version?: string
}

const manifestVersion = packageJson.version ?? '0.0.0'
const geckoId = process.env.FORKORFRY_GECKO_ID?.trim() || 'forkorfry@example.invalid'

export default defineConfig({
  browser: 'firefox',
  manifestVersion: 3,
  manifest: {
    name: 'ForkOrFry',
    description: 'Firefox-only idle parody takeover extension.',
    version: manifestVersion,
    icons: {
      16: 'icon-16.png',
      32: 'icon-32.png',
      48: 'icon-48.png',
      96: 'icon-96.png',
      128: 'icon-128.png',
    },
    browser_specific_settings: {
      gecko: {
        id: geckoId,
        data_collection_permissions: {
          required: ['none'],
        },
      },
    },
    action: {
      default_icon: {
        16: 'icon-16.png',
        32: 'icon-32.png',
      },
      theme_icons: [
        {
          light: 'icon-light-16.png',
          dark: 'icon-dark-16.png',
          size: 16,
        },
        {
          light: 'icon-light-32.png',
          dark: 'icon-dark-32.png',
          size: 32,
        },
      ],
      default_popup: 'popup.html',
      default_title: 'ForkOrFry',
    },
    background: {
      service_worker: 'background.js',
      type: 'module',
    },
    permissions: ['idle', 'storage', 'tabs'],
  },
  srcDir: 'src',
  outDir: 'dist',
  vite: () => ({
    build: {
      target: 'es2022',
    },
  }),
})
