/**
 * MAIN PROCESS ENTRY POINT — the app's "backend" and its launcher.
 *
 * Responsibilities, in order:
 *   1. Name the app (so its data folder is ".../Application Support/Arco").
 *   2. When Electron is ready: register all IPC handlers, build the menu,
 *      and open the window.
 *   3. Apply a Content-Security-Policy to the packaged app for hardening.
 *   4. Handle the standard macOS app lifecycle (reopen from dock, etc.).
 *
 * The window's `webPreferences` are the security backbone: the UI is isolated
 * (`contextIsolation`) and has no Node access (`nodeIntegration: false`), so
 * it can only reach the backend through the preload bridge.
 *
 * @see STANDARDS.md for coding standards and conventions of this codebase
 */
import { PRODUCT_NAME } from '@shared/config'
import { app, BrowserWindow, dialog, session, shell } from 'electron'
import { join } from 'node:path'
import { isDev } from './config/env'
import { registerIpcHandlers } from './ipc'
import { getDb } from './db/client'
import { buildAppMenu } from './window-menu'
import { initAutoUpdater } from './updater'

// Set the product name early so app.getPath('userData') resolves to a stable,
// branded folder in both dev and production.
app.setName(PRODUCT_NAME)

/** In dev, electron-vite serves the renderer over http and sets this env var. */
const RENDERER_DEV_URL = process.env.ELECTRON_RENDERER_URL

/** Wire up DevTools toggles — only available outside packaged production builds. */
function configureDevTools(win: BrowserWindow): void {
  if (!isDev()) return

  // Chrome-style shortcuts (Electron's View menu uses Option+Cmd+I by default).
  win.webContents.on('before-input-event', (_event, input) => {
    if (input.type !== 'keyDown' || !input.meta || !input.alt) return
    if (input.key === 'i' || input.key === 'j') {
      win.webContents.toggleDevTools()
    }
  })

  win.webContents.once('did-finish-load', () => {
    win.webContents.openDevTools()
  })
}

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 820,
    minHeight: 600,
    show: false, // avoid a white flash; reveal once content is ready
    backgroundColor: '#0a0a0a',
    // Standard macOS title bar (shows "Arco"). Reliable and needs no
    // custom drag regions. Can be swapped for 'hiddenInset' later for a
    // frameless look if desired.
    titleBarStyle: 'default',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true, // UI and preload run in separate JS contexts
      nodeIntegration: false, // UI cannot use Node APIs directly
      sandbox: false, // preload bundles the bridge; safe with the two flags above
      devTools: isDev()
    }
  })

  configureDevTools(win)
  win.once('ready-to-show', () => win.show())

  // Open any external links (e.g. an OpenRouter docs link) in the user's real
  // browser instead of inside the app window.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://') || url.startsWith('http://')) {
      shell.openExternal(url)
      return { action: 'deny' }
    }
    return { action: 'allow' }
  })

  if (RENDERER_DEV_URL) {
    win.loadURL(RENDERER_DEV_URL)
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

/**
 * Lock down what the renderer is allowed to load/connect to, in production.
 * (Skipped in dev because Vite's HMR needs inline scripts and a websocket.)
 * The UI itself makes no network calls — all OpenRouter traffic goes through
 * the main process — so a tight policy is safe.
 */
function applyContentSecurityPolicy(): void {
  if (RENDERER_DEV_URL) return
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self'; img-src 'self' data:; font-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'"
        ]
      }
    })
  })
}

// ── App lifecycle ─────────────────────────────────────────────────────────

app.whenReady().then(() => {
  // Open the database and run migrations BEFORE anything can query it. If this
  // fails, the backup has been restored (see client.ts) — show the user a clear
  // message and exit rather than running against a half-migrated database.
  try {
    getDb()
  } catch (err) {
    dialog.showErrorBox(
      'Database error',
      "Arco could not prepare its database, so it can’t start safely. Your data has been left untouched. Please reopen the app, and contact support if this keeps happening.\n\n" +
        String(err)
    )
    app.quit()
    return
  }

  registerIpcHandlers()
  buildAppMenu({ devTools: isDev() })
  applyContentSecurityPolicy()
  createWindow()
  initAutoUpdater()

  // macOS: re-create a window when the dock icon is clicked and none are open.
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// macOS convention: keep the app running in the dock after the window closes;
// quit on Windows/Linux.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
