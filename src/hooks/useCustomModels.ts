/**
 * Manages the user's custom (non-curated) model ids, which persist on disk via
 * the backend (settings-store.ts). Used by the model picker so that any model
 * id the user pastes sticks around across restarts.
 */
import { useCallback, useEffect, useState } from 'react'
import { api } from '@/lib/api'

export function useCustomModels() {
  const [customModels, setCustomModels] = useState<string[]>([])

  useEffect(() => {
    api.settings.getCustomModels().then(setCustomModels).catch(console.error)
  }, [])

  /** Persist a new custom model id; returns the updated list. */
  const add = useCallback(async (modelId: string) => {
    const next = await api.settings.addCustomModel(modelId)
    setCustomModels(next)
    return next
  }, [])

  /** Remove a custom model id from the saved list. */
  const remove = useCallback(async (modelId: string) => {
    const next = await api.settings.removeCustomModel(modelId)
    setCustomModels(next)
    return next
  }, [])

  return { customModels, add, remove }
}
