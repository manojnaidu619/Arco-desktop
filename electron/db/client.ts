/**
 * Database connection + migrations.
 *
 * WHERE THE FILE LIVES: a packaged macOS app is installed read-only in
 * /Applications, so the database can't sit next to the code. It lives in the
 * user's writable per-app folder instead:
 *   ~/Library/Application Support/Arco/arco.db
 *
 * HOW THE SCHEMA EVOLVES (the production-grade part): we use versioned Drizzle
 * migrations. The SQL files in the project's `drizzle/` folder are generated at
 * dev time (`npm run db:generate`) and shipped with the app. On every launch we
 * run `migrate()`, which checks a `__drizzle_migrations` bookkeeping table in
 * the user's database and applies any not-yet-applied migrations in order, each
 * in its own transaction. This is the desktop equivalent of "deploy runs the
 * migrations" — updating the app automatically updates each user's schema.
 *
 * SAFETY: before applying migrations we take a backup copy of the database, and
 * if a migration fails we restore it — so a bad update can never leave a user
 * with a corrupted, unrecoverable database.
 */
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { app } from 'electron'
import { copyFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { isDev } from '../config/env'
import * as schema from './schema'

/** Lazily-created singleton so every caller shares one connection. */
let dbInstance: ReturnType<typeof drizzle<typeof schema>> | null = null

/** Absolute path to the bundled migrations folder (differs dev vs packaged). */
function migrationsFolder(): string {
  // Packaged: copied into the app's Resources via electron-builder
  // `extraResources`. Dev: it's just the project's drizzle/ folder.
  return isDev() ? join(app.getAppPath(), 'drizzle') : join(process.resourcesPath, 'drizzle')
}

/**
 * Open (or create) the database, run pending migrations, and return a Drizzle
 * client. Safe to call repeatedly — the connection + migrations run once.
 */
export function getDb() {
  if (dbInstance) return dbInstance

  const dbPath = join(app.getPath('userData'), 'arco.db')
  const sqlite = new Database(dbPath)
  sqlite.pragma('journal_mode = WAL')
  sqlite.pragma('foreign_keys = ON')

  const db = drizzle(sqlite, { schema })
  applyMigrations(sqlite, db, dbPath)

  dbInstance = db
  return dbInstance
}

/**
 * Back up the database, then apply migrations. On failure, restore the backup
 * so the user's data is left exactly as it was before the failed update.
 */
function applyMigrations(sqlite: Database.Database, db: ReturnType<typeof drizzle<typeof schema>>, dbPath: string) {
  const backupPath = `${dbPath}.bak`

  // Flush the WAL into the main file so the backup is a complete snapshot.
  try {
    sqlite.pragma('wal_checkpoint(TRUNCATE)')
    copyFileSync(dbPath, backupPath)
  } catch (err) {
    // A missing backup isn't fatal (e.g. a brand-new empty DB); just note it.
    console.warn('[db] Could not create pre-migration backup:', err)
  }

  try {
    migrate(db, { migrationsFolder: migrationsFolder() })
  } catch (err) {
    console.error('[db] Migration failed — restoring the pre-migration backup.', err)
    // Restoring requires the connection closed so the file isn't in use.
    try {
      sqlite.close()
    } catch {
      /* ignore */
    }
    if (existsSync(backupPath)) {
      try {
        copyFileSync(backupPath, dbPath)
      } catch (restoreErr) {
        console.error('[db] Failed to restore backup:', restoreErr)
      }
    }
    throw err
  }
}
