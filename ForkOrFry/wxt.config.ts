import { defineConfig } from 'wxt'

export default defineConfig({
  browser: 'firefox',
  manifestVersion: 3,
  manifest: {
    name: 'ForkOrFry',
    description: 'Firefox-only idle parody takeover extension.',
    version: '0.0.0',
    browser_specific_settings: {
      gecko: {
        id: 'forkorfry@example.invalid',
        data_collection_permissions: {
          required: ['none'],
        },
      },
    },
    action: {
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
