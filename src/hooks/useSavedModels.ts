/**
 * React context + hook for the user's saved model library.
 *
 * Wraps the backend `savedModels` list so dropdowns, panes, onboarding, and the
 * model manager modal all share the same source of truth. The library is persisted
 * via the main process and loaded on app startup.
 *
 * @used-by Onboarding, ModelDropdown, ModelManagerModal, ModelPane, useChat
 * @see STANDARDS.md for coding standards and conventions of this codebase
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

/**
 * Shape of the saved models context value exposed to consumers.
 */
interface SavedModelsContextValue {
  /** Array of OpenRouter model ids the user has saved. */
  savedModels: string[]
  /** True until the initial fetch from the backend completes. */
  loading: boolean
  /** Re-fetch the saved models from the backend. */
  refresh: () => Promise<string[]>
  /** Replace the entire library with a new set of model ids. */
  set: (modelIds: string[]) => Promise<string[]>
  /** Validate and add a single model id to the library. */
  add: (modelId: string) => Promise<AddSavedModelResult>
  /** Remove a model id from the library. */
  remove: (modelId: string) => Promise<string[]>
}

const SavedModelsContext = createContext<SavedModelsContextValue | null>(null)

/**
 * Provider component that wraps the app and supplies the saved models context.
 *
 * @used-by App (wraps the entire application)
 * @param children — React children to render within the provider
 */
export function SavedModelsProvider({ children }: { children: ReactNode }) {
  const [savedModels, setSavedModels] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  /**
   * Fetch the current saved models list from the backend.
   *
   * @used-by initial mount, ModelManagerModal on open
   * @returns the refreshed array of model ids
   */
  const refresh = useCallback(async () => {
    const models = await api.settings.getSavedModels()
    setSavedModels(models)
    return models
  }, [])

  // Load saved models once on mount
  useEffect(() => {
    refresh()
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [refresh])

  /**
   * Replace the entire saved model library.
   *
   * @used-by Onboarding when the user confirms their model selection
   * @param modelIds — complete set of model ids to save
   * @returns the persisted model ids (may differ if backend normalizes)
   */
  const set = useCallback(async (modelIds: string[]) => {
    const next = await api.settings.setSavedModels(modelIds)
    setSavedModels(next)
    return next
  }, [])

  /**
   * Validate a model id against OpenRouter and add it to the library.
   *
   * @used-by ModelManagerModal, ModelInput
   * @param modelId — OpenRouter model id to validate and add
   * @returns result with success flag and updated models array
   */
  const add = useCallback(async (modelId: string) => {
    const result = await api.settings.addSavedModel(modelId)
    if (result.ok) setSavedModels(result.models)
    return result
  }, [])

  /**
   * Remove a model from the user's saved library.
   *
   * @used-by ModelManagerModal, ModelDropdown
   * @param modelId — OpenRouter model id to remove
   * @returns the updated array of saved model ids
   */
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

/**
 * Hook to access the saved models context.
 *
 * @used-by Any component needing access to the user's model library
 * @returns the saved models context value
 * @throws Error if used outside of SavedModelsProvider
 */
export function useSavedModels(): SavedModelsContextValue {
  const ctx = useContext(SavedModelsContext)
  if (!ctx) {
    throw new Error('useSavedModels must be used within a SavedModelsProvider')
  }
  return ctx
}
