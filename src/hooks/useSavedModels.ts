/**
 * React context + hook for the user's saved model library.
 *
 * Wraps the backend `savedModels` list so dropdowns, panes, onboarding, and the
 * model manager modal all share the same source of truth. The library is persisted
 * via the main process and loaded on app startup.
 *
 * @used-by Onboarding, ModelDropdown, ModelManagerModal, ModelManagerPanel, ModelPane, useChat
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
import type { SavedModel } from '@shared/types'

/**
 * Shape of the saved models context value exposed to consumers.
 */
interface SavedModelsContextValue {
  /** User's saved model library with labels and colors. */
  savedModels: SavedModel[]
  /** True until the initial fetch from the backend completes. */
  loading: boolean
  /** Re-fetch the saved models from the backend. */
  refresh: () => Promise<SavedModel[]>
  /** Replace the entire library with a new set of models. */
  set: (models: SavedModel[]) => Promise<SavedModel[]>
  /** Validate and add a single model to the library. */
  add: (openRouterModelId: string, color: string) => Promise<AddSavedModelResult>
  /** Remove a model from the library. */
  remove: (openRouterModelId: string) => Promise<SavedModel[]>
}

const SavedModelsContext = createContext<SavedModelsContextValue | null>(null)

/**
 * Provider component that wraps the app and supplies the saved models context.
 *
 * @used-by App (wraps the entire application)
 * @param children — React children to render within the provider
 */
export function SavedModelsProvider({ children }: { children: ReactNode }) {
  const [savedModels, setSavedModels] = useState<SavedModel[]>([])
  const [loading, setLoading] = useState(true)

  /**
   * Fetch the current saved models list from the backend.
   *
   * @used-by initial mount, ModelManagerModal on open, Onboarding seeding
   * @returns the refreshed array of saved models
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
   * @used-by Onboarding to seed default models on first visit to model selection
   * @param models — complete set of models to save
   * @returns the persisted models (may differ if backend normalizes)
   */
  const set = useCallback(async (models: SavedModel[]) => {
    const next = await api.settings.setSavedModels(models)
    setSavedModels(next)
    return next
  }, [])

  /**
   * Validate a model id against OpenRouter and add it to the library.
   *
   * @used-by ModelManagerPanel, ModelInput
   * @param openRouterModelId — OpenRouter model ID to validate and add, e.g. "openai/gpt-4o"
   * @param color — hex color for UI dots/badges
   * @returns result with success flag and updated models array
   */
  const add = useCallback(async (openRouterModelId: string, color: string) => {
    const result = await api.settings.addSavedModel(openRouterModelId, color)
    if (result.ok) setSavedModels(result.models)
    return result
  }, [])

  /**
   * Remove a model from the user's saved library.
   *
   * @used-by ModelManagerPanel, ModelDropdown
   * @param openRouterModelId — OpenRouter model ID to remove, e.g. "openai/gpt-4o"
   * @returns the updated array of saved models
   */
  const remove = useCallback(async (openRouterModelId: string) => {
    const next = await api.settings.removeSavedModel(openRouterModelId)
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
