/**
 * Auto-update wiring (electron-updater + Cloudflare R2).
 *
 * electron-builder publishes `latest-mac.yml` + the `.zip` to a public R2
 * bucket on every release (see scripts/upload-release.sh). At runtime the
 * packaged app polls that URL, downloads the new zip, and swaps the app in
 * place on the next launch.
 *
 * Flow on the UI side:
 *   1. `update-available` → renderer shows "Update v{x} available" + Download
 *   2. user clicks Download → main calls autoUpdater.downloadUpdate()
 *   3. `download-progress` events → renderer shows progress bar
 *   4. `update-downloaded` → renderer shows "Restart to install"
 *   5. user clicks Restart → main calls autoUpdater.quitAndInstall()
 *
 * Skipped entirely in dev: electron-updater requires a signed packaged app
 * and a real `latest-mac.yml` to function.
 *
 * @see STANDARDS.md for coding standards and conventions of this codebase
 */
import { BrowserWindow, ipcMain } from 'electron'
import { autoUpdater } from 'electron-updater'
import { CHANNELS, type UpdateInfoPayload, type UpdateProgressPayload } from '@shared/api-contract'
import { isDev } from './config/env'

const FOUR_HOURS_MS = 4 * 60 * 60 * 1000

function broadcast(channel: string, payload?: unknown): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send(channel, payload)
  }
}

export function initAutoUpdater(): void {
  if (isDev()) return

  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = true

  // Local-testing hook: when ARCO_UPDATE_FEED_URL is set, ignore the baked-in
  // R2 feed and poll the override URL instead. Only takes effect when the
  // user launches the app from Terminal with the env var set, so production
  // users (who double-click the dock icon) are never affected.
  // See docs/releasing.md → "Testing the update flow locally".
  const overrideFeedUrl = process.env.ARCO_UPDATE_FEED_URL
  if (overrideFeedUrl) {
    autoUpdater.setFeedURL({ provider: 'generic', url: overrideFeedUrl, channel: 'latest' })
  }

  autoUpdater.on('update-available', (info) => {
    const payload: UpdateInfoPayload = {
      version: info.version,
      releaseDate: info.releaseDate,
      releaseNotes: typeof info.releaseNotes === 'string' ? info.releaseNotes : undefined
    }
    broadcast(CHANNELS.updater.available, payload)
  })

  autoUpdater.on('download-progress', (progress) => {
    const payload: UpdateProgressPayload = {
      percent: progress.percent,
      bytesPerSecond: progress.bytesPerSecond,
      transferred: progress.transferred,
      total: progress.total
    }
    broadcast(CHANNELS.updater.progress, payload)
  })

  autoUpdater.on('update-downloaded', (info) => {
    const payload: UpdateInfoPayload = {
      version: info.version,
      releaseDate: info.releaseDate,
      releaseNotes: typeof info.releaseNotes === 'string' ? info.releaseNotes : undefined
    }
    broadcast(CHANNELS.updater.downloaded, payload)
  })

  autoUpdater.on('error', (err) => {
    broadcast(CHANNELS.updater.error, { message: err?.message ?? String(err) })
  })

  ipcMain.handle(CHANNELS.updater.check, async () => {
    try {
      await autoUpdater.checkForUpdates()
    } catch (err) {
      broadcast(CHANNELS.updater.error, { message: err instanceof Error ? err.message : String(err) })
    }
  })

  ipcMain.handle(CHANNELS.updater.download, async () => {
    try {
      await autoUpdater.downloadUpdate()
    } catch (err) {
      broadcast(CHANNELS.updater.error, { message: err instanceof Error ? err.message : String(err) })
    }
  })

  ipcMain.handle(CHANNELS.updater.install, () => {
    autoUpdater.quitAndInstall()
  })

  // Initial check shortly after launch, then every 4h while the app runs.
  setTimeout(() => {
    autoUpdater.checkForUpdates().catch(() => {})
  }, 5000)
  setInterval(() => {
    autoUpdater.checkForUpdates().catch(() => {})
  }, FOUR_HOURS_MS)
}
