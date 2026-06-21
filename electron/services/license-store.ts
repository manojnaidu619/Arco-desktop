/**
 * Encrypted local storage for an activated Unlimited license.
 *
 * Uses Electron `safeStorage` (macOS Keychain-backed), same pattern as
 * secure-store.ts for the OpenRouter API key. The encrypted blob lives at
 * ~/Library/Application Support/Arco/license.bin — copying it to another
 * machine typically fails decryption, so Unlimited does not travel with the file.
 */
import { app, safeStorage } from 'electron'
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

export interface StoredLicense {
  /** License key string, e.g. 7J9OY-3XMF1-OF7LN-ATRCH-38U6S */
  key: string
  /** ISO timestamp when activation succeeded. */
  activatedAt: string
  /** node-machine-id fingerprint sent to the server at activation. */
  deviceId: string
}

function licensePath(): string {
  return join(app.getPath('userData'), 'license.bin')
}

function parseLicense(json: string): StoredLicense | null {
  try {
    const parsed = JSON.parse(json) as Partial<StoredLicense>
    if (
      typeof parsed.key === 'string' &&
      typeof parsed.activatedAt === 'string' &&
      typeof parsed.deviceId === 'string'
    ) {
      return {
        key: parsed.key,
        activatedAt: parsed.activatedAt,
        deviceId: parsed.deviceId
      }
    }
    return null
  } catch {
    return null
  }
}

/** Read and decrypt stored license, or null if none / unreadable. */
export function readLicense(): StoredLicense | null {
  const path = licensePath()
  if (!existsSync(path)) return null

  try {
    const decrypted = safeStorage.decryptString(readFileSync(path))
    return parseLicense(decrypted)
  } catch {
    // Corrupted or moved to another machine — treat as absent.
    return null
  }
}

/** Encrypt and persist license after successful server activation. */
export function writeLicense(license: StoredLicense): void {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('Secure storage is unavailable on this system.')
  }
  const encrypted = safeStorage.encryptString(JSON.stringify(license))
  writeFileSync(licensePath(), encrypted)
}

/** Whether a decryptable license is stored locally. */
export function hasActivatedLicense(): boolean {
  return readLicense() !== null
}
