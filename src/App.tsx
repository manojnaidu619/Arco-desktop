/**
 * Root component and the app's top-level gate.
 *
 * Flow:
 *   1. Ask the backend whether an API key is stored (`hasKey`).
 *   2. While unknown → a brief loading spinner.
 *   3. No key → the Onboarding screen (API key step).
 *   4. Key but onboarding incomplete → Onboarding (model selection step).
 *   5. Ready → the main app, with the Settings modal layered on top.
 *
 * Removing the key from Settings flips `hasKey` back to false, returning the
 * user to onboarding — all without a reload.
 *
 * @see STANDARDS.md for coding standards and conventions of this codebase
 */
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { Onboarding } from '@/components/Onboarding'
import { MainApp } from '@/components/MainApp'
import { SettingsDialog } from '@/components/settings/SettingsDialog'
import { LicenseModal } from '@/components/license/LicenseModal'
import { UpdateDialog } from '@/components/UpdateDialog'
import { SavedModelsProvider } from '@/hooks/useSavedModels'
import { Loader2 } from 'lucide-react'

export function App() {
  // null = still checking, true/false = known.
  const [hasKey, setHasKey] = useState<boolean | null>(null)
  const [onboardingComplete, setOnboardingComplete] = useState<boolean | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [licenseOpen, setLicenseOpen] = useState(false)
  const [isLicenseActivated, setIsLicenseActivated] = useState(false)

  useEffect(() => {
    Promise.all([
      api.settings.getKeyStatus(),
      api.settings.isOnboardingCompleted(),
      api.license.getStatus()
    ])
      .then(([keyStatus, completed, licenseStatus]) => {
        setHasKey(keyStatus.hasKey)
        setOnboardingComplete(completed)
        setIsLicenseActivated(licenseStatus.isActivated)
      })
      .catch(() => {
        setHasKey(false)
        setOnboardingComplete(false)
        setIsLicenseActivated(false)
      })
  }, [])

  if (hasKey === null || onboardingComplete === null) {
    return (
      <div className="flex h-screen items-center justify-center bg-background text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    )
  }

  // SavedModelsProvider wraps onboarding too so model selection uses the same library as Settings.
  return (
    <SavedModelsProvider>
      <UpdateDialog />
      {!hasKey ? (
        <Onboarding
          onComplete={() => {
            setHasKey(true)
            setOnboardingComplete(true)
          }}
        />
      ) : !onboardingComplete ? (
        <Onboarding initialStep="model-selection" onComplete={() => setOnboardingComplete(true)} />
      ) : (
        <>
          <MainApp
            onOpenSettings={() => setSettingsOpen(true)}
            isLicenseActivated={isLicenseActivated}
            onOpenLicense={() => setLicenseOpen(true)}
          />
          {licenseOpen && (
            <LicenseModal
              onClose={() => setLicenseOpen(false)}
              onActivated={() => setIsLicenseActivated(true)}
            />
          )}
          {settingsOpen && (
            <SettingsDialog
              onClose={() => setSettingsOpen(false)}
              onKeyCleared={() => {
                setSettingsOpen(false)
                setHasKey(false)
                setOnboardingComplete(false)
              }}
            />
          )}
        </>
      )}
    </SavedModelsProvider>
  )
}
