/**
 * React hook for the user's saved model library.
 *
 * Wraps the backend `savedModels` list so dropdowns, onboarding, and the
 * model manager modal all share the same source of truth.
 */
import { useCallback, useEffect, useState } from 'react'
import { api } from '@/lib/api'

export function useSavedModels() {
  const [savedModels, setSavedModels] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    const models = await api.settings.getSavedModels()
    setSavedModels(models)
    return models
  }, [])

  useEffect(() => {
    refresh()
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [refresh])

  /** Replace the entire library (used when finishing onboarding). */
  const set = useCallback(async (modelIds: string[]) => {
    const next = await api.settings.setSavedModels(modelIds)
    setSavedModels(next)
    return next
  }, [])

  /** Validate against OpenRouter and persist a new model id. */
  const add = useCallback(async (modelId: string) => {
    const result = await api.settings.addSavedModel(modelId)
    if (result.ok) setSavedModels(result.models)
    return result
  }, [])

  /** Remove a model from the library. */
  const remove = useCallback(async (modelId: string) => {
    const next = await api.settings.removeSavedModel(modelId)
    setSavedModels(next)
    return next
  }, [])

  return { savedModels, loading, refresh, set, add, remove }
}
