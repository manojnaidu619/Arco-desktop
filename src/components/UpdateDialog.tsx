/**
 * Update-available modal. Driven entirely by IPC events from the main-process
 * auto-updater (see electron/updater.ts).
 *
 * State machine:
 *   • idle       — no update yet; nothing rendered
 *   • available  — show "v{x} available. Download / Later"
 *   • downloading — show progress bar (user committed; no Cancel)
 *   • downloaded — show "Restart to install / Later"
 *
 * Errors during the active flow swap the dialog into a small error notice the
 * user can dismiss. Errors while idle stay silent (background check failures
 * shouldn't interrupt the user).
 *
 * @see STANDARDS.md for coding standards and conventions of this codebase
 */
import { Button } from '@/components/ui/button'
import { api } from '@/lib/api'
import { AlertCircle, Download, RotateCw } from 'lucide-react'
import { useEffect, useState } from 'react'

type Status = 'idle' | 'available' | 'downloading' | 'downloaded' | 'error'

interface State {
  status: Status
  version?: string
  percent?: number
  errorMessage?: string
}

export function UpdateDialog() {
  const [state, setState] = useState<State>({ status: 'idle' })

  useEffect(() => {
    const offAvailable = api.updater.onAvailable((info) => {
      setState({ status: 'available', version: info.version })
    })
    const offProgress = api.updater.onProgress((p) => {
      setState((prev) =>
        prev.status === 'downloading' || prev.status === 'available'
          ? { ...prev, status: 'downloading', percent: p.percent }
          : prev
      )
    })
    const offDownloaded = api.updater.onDownloaded((info) => {
      setState({ status: 'downloaded', version: info.version })
    })
    const offError = api.updater.onError((err) => {
      // Stay quiet on background failures; only surface if user was mid-flow.
      setState((prev) =>
        prev.status === 'downloading' || prev.status === 'available'
          ? { ...prev, status: 'error', errorMessage: err.message }
          : prev
      )
    })

    return () => {
      offAvailable()
      offProgress()
      offDownloaded()
      offError()
    }
  }, [])

  if (state.status === 'idle') return null

  const dismiss = () => setState({ status: 'idle' })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-6">
      <div
        className="w-full max-w-sm rounded-xl border border-border bg-background p-5 shadow-xl"
        role="alertdialog"
        aria-labelledby="update-dialog-title"
        aria-describedby="update-dialog-message"
      >
        {state.status === 'available' && (
          <>
            <div className="flex items-center gap-2 mb-2">
              <Download className="h-4 w-4 text-primary shrink-0" />
              <h2 id="update-dialog-title" className="text-sm font-semibold">
                Update available
              </h2>
            </div>
            <p id="update-dialog-message" className="text-sm text-muted-foreground leading-relaxed">
              A new version of Arco{state.version ? ` (v${state.version})` : ''} is ready to download.
            </p>
            <div className="flex flex-col gap-2 mt-4">
              <Button
                className="w-full"
                onClick={() => {
                  setState((prev) => ({ ...prev, status: 'downloading', percent: 0 }))
                  api.updater.download().catch(() => { })
                }}
              >
                <Download className="h-4 w-4" />
                Download
              </Button>
              <Button variant="outline" className="w-full" onClick={dismiss}>
                Later
              </Button>
            </div>
          </>
        )}

        {state.status === 'downloading' && (
          <>
            <div className="flex items-center gap-2 mb-2">
              <Download className="h-4 w-4 text-primary shrink-0" />
              <h2 id="update-dialog-title" className="text-sm font-semibold">
                Downloading update
              </h2>
            </div>
            <p id="update-dialog-message" className="text-sm text-muted-foreground leading-relaxed">
              {Math.round(state.percent ?? 0)}% — keep the app open while the download finishes.
            </p>
            <div
              className="mt-4 h-2 w-full overflow-hidden rounded-full bg-muted"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(state.percent ?? 0)}
            >
              <div
                className="h-full bg-primary transition-[width] duration-150"
                style={{ width: `${state.percent ?? 0}%` }}
              />
            </div>
          </>
        )}

        {state.status === 'downloaded' && (
          <>
            <div className="flex items-center gap-2 mb-2">
              <RotateCw className="h-4 w-4 text-primary shrink-0" />
              <h2 id="update-dialog-title" className="text-sm font-semibold">
                Update ready
              </h2>
            </div>
            <p id="update-dialog-message" className="text-sm text-muted-foreground leading-relaxed">
              Arco{state.version ? ` v${state.version}` : ''} is ready. Restart now to apply the update.
            </p>
            <div className="flex flex-col gap-2 mt-4">
              <Button
                className="w-full"
                onClick={() => {
                  api.updater.install().catch(() => { })
                }}
              >
                <RotateCw className="h-4 w-4" />
                Restart and install
              </Button>
              <Button variant="outline" className="w-full" onClick={dismiss}>
                Later
              </Button>
            </div>
          </>
        )}

        {state.status === 'error' && (
          <>
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
              <h2 id="update-dialog-title" className="text-sm font-semibold">
                Update failed
              </h2>
            </div>
            <p id="update-dialog-message" className="text-sm text-muted-foreground leading-relaxed">
              {state.errorMessage ?? 'Something went wrong while downloading the update.'}
            </p>
            <div className="flex flex-col gap-2 mt-4">
              <Button variant="outline" className="w-full" onClick={dismiss}>
                Dismiss
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
