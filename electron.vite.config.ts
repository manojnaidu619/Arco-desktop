import { resolve } from 'node:path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

/**
 * electron-vite configuration.
 *
 * An Electron app is really THREE separate bundles, each with its own
 * environment, and this file describes how to build all three:
 *
 *   1. `main`     — the Node.js "backend" process (window lifecycle, DB,
 *                   network, secrets). Entry: electron/main.ts
 *   2. `preload`  — the tiny secure bridge that runs between main and the
 *                   UI and defines `window.api`. Entry: electron/preload.ts
 *   3. `renderer` — the React UI shown in the window. Entry: index.html
 *
 * `externalizeDepsPlugin()` tells the bundler NOT to bundle npm
 * dependencies into the main/preload output. That's essential for native
 * modules like `better-sqlite3`, which must be loaded from node_modules at
 * runtime (and unpacked from the asar archive — see electron-builder.yml).
 *
 * @see STANDARDS.md for coding standards and conventions of this codebase
 */
export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: { '@shared': resolve('shared') }
    },
    build: {
      rollupOptions: {
        input: { index: resolve('electron/main.ts') }
      }
    }
  },

  preload: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: { '@shared': resolve('shared') }
    },
    build: {
      rollupOptions: {
        input: { index: resolve('electron/preload.ts') }
      }
    }
  },

  renderer: {
    // The renderer is a normal Vite + React app. Its root is the project
    // root, where index.html lives.
    root: '.',
    resolve: {
      alias: {
        '@': resolve('src'),
        '@shared': resolve('shared')
      }
    },
    plugins: [react(), tailwindcss()],
    build: {
      rollupOptions: {
        input: { index: resolve('index.html') }
      }
    }
  }
})
