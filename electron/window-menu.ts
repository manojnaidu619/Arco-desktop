/**
 * Native application menu.
 *
 * Without an explicit menu, Electron's default menu still works, but building
 * our own lets us label it "Multi-Mind" and keep only the items that make
 * sense. Almost everything here uses Electron's built-in "roles", which wire
 * up the standard macOS keyboard shortcuts automatically:
 *   Cmd+C / Cmd+V / Cmd+A (copy/paste/select all), Cmd+Q (quit),
 *   Cmd+W (close), Cmd+M (minimize), Cmd+R (reload), etc.
 */
import { app, Menu, type MenuItemConstructorOptions } from 'electron'

export function buildAppMenu(): void {
  const isMac = process.platform === 'darwin'

  const template: MenuItemConstructorOptions[] = [
    // App menu (macOS only): About / Hide / Quit Multi-Mind.
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: 'about' as const },
              { type: 'separator' as const },
              { role: 'hide' as const },
              { role: 'hideOthers' as const },
              { role: 'unhide' as const },
              { type: 'separator' as const },
              { role: 'quit' as const }
            ]
          }
        ]
      : []),

    {
      label: 'File',
      submenu: [isMac ? { role: 'close' } : { role: 'quit' }]
    },

    // Standard editing shortcuts — these make copy/paste work in inputs and
    // when selecting model responses.
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' }
      ]
    },

    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },

    {
      label: 'Window',
      submenu: [{ role: 'minimize' }, { role: 'zoom' }, ...(isMac ? [{ role: 'front' as const }] : [{ role: 'close' as const }])]
    }
  ]

  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}
