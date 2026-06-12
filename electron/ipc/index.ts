/**
 * Registers every IPC handler in one place. Called once from main.ts on
 * startup, before the window loads. To add a new domain of functionality,
 * create a `register*Handlers` function in a sibling file and call it here.
 */
import { registerChatHandlers } from './chat'
import { registerSessionHandlers } from './sessions'
import { registerSettingsHandlers } from './settings'

export function registerIpcHandlers(): void {
  registerSessionHandlers()
  registerChatHandlers()
  registerSettingsHandlers()
}
