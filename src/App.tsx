/**
 * Root component and the app's top-level gate.
 *
 * Flow:
 *   1. Ask the backend whether an API key is stored (`hasKey`).
 *   2. While unknown → a brief loading spinner.
 *   3. No key → the Onboarding screen.
 *   4. Has key → the main app, with the Settings modal layered on top.
 *
 * Removing the key from Settings flips `hasKey` back to false, returning the
 * user to onboarding — all without a reload.
 */
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { Onboarding } from '@/components/Onboarding'
import { MainApp } from '@/components/MainApp'
import { SettingsDialog } from '@/components/SettingsDialog'
import { Loader2 } from 'lucide-react'

export function App() {
  // null = still checking, true/false = known.
  const [hasKey, setHasKey] = useState<boolean | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)

  useEffect(() => {
    api.settings
      .getKeyStatus()
      .then((status) => setHasKey(status.hasKey))
      .catch(() => setHasKey(false))
  }, [])

  if (hasKey === null) {
    return (
      <div className="flex h-screen items-center justify-center bg-background text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    )
  }

  if (!hasKey) {
    return <Onboarding onComplete={() => setHasKey(true)} />
  }

  return (
    <>
      <MainApp onOpenSettings={() => setSettingsOpen(true)} />
      {settingsOpen && (
        <SettingsDialog
          onClose={() => setSettingsOpen(false)}
          onKeyCleared={() => {
            setSettingsOpen(false)
            setHasKey(false)
          }}
        />
      )}
    </>
  )
}
