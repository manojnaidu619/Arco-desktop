/**
 * React context + hook for the user's saved model library.
 *
 * Wraps the backend `savedModels` list so dropdowns, panes, onboarding, and the
 * model manager modal all share the same source of truth.
 */
import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode
} from 'react'
import { api } from '@/lib/api'
import type { AddSavedModelResult } from '@shared/api-contract'

interface SavedModelsContextValue {
  savedModels: string[]
  loading: boolean
  refresh: () => Promise<string[]>
  set: (modelIds: string[]) => Promise<string[]>
  add: (modelId: string) => Promise<AddSavedModelResult>
  remove: (modelId: string) => Promise<string[]>
}

const SavedModelsContext = createContext<SavedModelsContextValue | null>(null)

export function SavedModelsProvider({ children }: { children: ReactNode }) {
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

  return createElement(
    SavedModelsContext.Provider,
    { value: { savedModels, loading, refresh, set, add, remove } },
    children
  )
}

export function useSavedModels(): SavedModelsContextValue {
  const ctx = useContext(SavedModelsContext)
  if (!ctx) {
    throw new Error('useSavedModels must be used within a SavedModelsProvider')
  }
  return ctx
}
