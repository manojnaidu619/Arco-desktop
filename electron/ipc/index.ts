/**
 * Central IPC handler registry. Called once from main.ts on startup, before
 * the window loads.
 *
 * To add a new domain of functionality:
 *   1. Create a `register*Handlers` function in a sibling file
 *   2. Import and call it in registerIpcHandlers() below
 *
 * Handler order doesn't matter since channels are unique strings.
 *
 * @see STANDARDS.md for coding standards and conventions of this codebase
 */
import { registerChatHandlers } from './chat'
import { registerLicenseHandlers } from './license'
import { registerSessionHandlers } from './sessions'
import { registerSettingsHandlers } from './settings'
import { registerSummaryHandlers } from './summary'

/**
 * Register all IPC handlers for the application.
 *
 * @used-by main.ts on app.whenReady()
 */
export function registerIpcHandlers(): void {
  registerSessionHandlers()  // Conversation persistence (SQLite)
  registerChatHandlers()     // Streaming chat with OpenRouter
  registerSummaryHandlers()  // Multi-model response summarization
  registerSettingsHandlers() // API key + model library management
  registerLicenseHandlers()  // Pro plan license activation
}
