/**
 * Secure storage for the user's OpenRouter API key.
 *
 * We use Electron's `safeStorage`, which on macOS encrypts data with a key
 * held in the system Keychain (the same vault Safari uses for passwords).
 * The encrypted blob is written to a file in the app's data folder. Even if
 * someone copied that file off the disk, they couldn't read the key without
 * the user's macOS login.
 *
 * The decrypted key NEVER leaves the main process — the renderer can ask us
 * to save/clear/validate it, but can't read it back.
 */
import { app, safeStorage } from 'electron'
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

/** Where the encrypted key lives: ~/Library/Application Support/Multi-Mind/credentials.bin */
function credentialsPath(): string {
  return join(app.getPath('userData'), 'credentials.bin')
}

/** True if an API key is currently stored on disk. */
export function hasKey(): boolean {
  return existsSync(credentialsPath())
}

/**
 * Read and decrypt the stored API key.
 * @returns the key, or null if none is stored / decryption fails.
 */
export function getKey(): string | null {
  const path = credentialsPath()
  if (!existsSync(path)) return null
  try {
    const encrypted = readFileSync(path)
    return safeStorage.decryptString(encrypted)
  } catch {
    // Corrupted or unreadable (e.g. moved to another machine) — treat as absent.
    return null
  }
}

/**
 * Encrypt and persist the API key.
 * @throws if OS-level encryption isn't available (very rare on macOS).
 */
export function setKey(key: string): void {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('Secure storage is unavailable on this system.')
  }
  const encrypted = safeStorage.encryptString(key.trim())
  writeFileSync(credentialsPath(), encrypted)
}

/** Delete the stored key (returns the app to the onboarding gate). */
export function clearKey(): void {
  const path = credentialsPath()
  if (existsSync(path)) rmSync(path)
}
