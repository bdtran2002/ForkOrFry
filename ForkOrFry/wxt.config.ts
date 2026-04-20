import { defineConfig } from 'wxt'

export default defineConfig({
  browser: 'firefox',
  manifestVersion: 3,
  manifest: {
    name: 'ForkOrFry',
    description: 'Firefox-only idle parody takeover extension.',
    version: '0.0.0',
    icons: {
      16: 'icon-16.png',
      32: 'icon-32.png',
      48: 'icon-48.png',
      96: 'icon-96.png',
      128: 'icon-128.png',
    },
    browser_specific_settings: {
      gecko: {
        id: 'forkorfry@example.invalid',
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
