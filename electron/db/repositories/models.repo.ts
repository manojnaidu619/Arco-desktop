/**
 * Saved model library — CRUD for the `models` table.
 *
 * The user's model library lives in SQLite (not settings.json). Threads reference
 * models by integer FK; this repo exposes OpenRouter model ID strings at the boundary.
 *
 * @see STANDARDS.md for coding standards and conventions of this codebase
 */
import { and, asc, desc, eq, isNull } from 'drizzle-orm'
import {
  formatOpenRouterModelId,
  getCuratedColorByOpenRouterId,
  getModelDef,
  parseOpenRouterModelId
} from '@shared/models'
import type { SavedModel } from '@shared/types'
import { getDb } from '../client'
import { models } from '../schema'

const now = () => new Date().toISOString()

/** Internal row shape for the `models` table. `id` is the database row ID. */
export interface ModelRow {
  /** Database row ID (auto-increment primary key). */
  id: number
  /** OpenRouter author (provider), e.g. "openai". */
  author: string
  /** Model name slug, e.g. "gpt-4o". Full ID = `${author}/${slug}`. */
  slug: string
  label: string
  color: string
  createdAt: string
  deletedAt: string | null
}

/** Compose the OpenRouter model ID from a database row. */
function toOpenRouterModelId(row: { author: string; slug: string }): string {
  return formatOpenRouterModelId(row.author, row.slug)
}

function mapRow(row: typeof models.$inferSelect): ModelRow {
  return {
    id: row.id,
    author: row.author,
    slug: row.slug,
    label: row.label,
    color: row.color,
    createdAt: row.createdAt,
    deletedAt: row.deletedAt
  }
}

function toSavedModel(row: ModelRow): SavedModel {
  return {
    openRouterModelId: toOpenRouterModelId(row),
    label: row.label,
    color: row.color
  }
}

/** Active library models, newest first. */
export function listActive(): SavedModel[] {
  const db = getDb()
  const rows = db
    .select()
    .from(models)
    .where(isNull(models.deletedAt))
    .orderBy(desc(models.createdAt))
    .all()

  return rows.map((row) => toSavedModel(mapRow(row)))
}

/**
 * Find a model row by OpenRouter model ID.
 *
 * @param openRouterModelId - OpenRouter model ID, e.g. "openai/gpt-4o"
 * @returns Model row if found, null otherwise
 *
 * @example
 *   findByOpenRouterId("anthropic/claude-opus-4.8")
 *   // → { id: 5, author: "anthropic", slug: "claude-opus-4.8", ... }
 */
export function findByOpenRouterId(openRouterModelId: string): ModelRow | null {
  const parsed = parseOpenRouterModelId(openRouterModelId.trim())
  if (!parsed) return null

  const row = getDb()
    .select()
    .from(models)
    .where(and(eq(models.author, parsed.author), eq(models.slug, parsed.slug)))
    .get()

  return row ? mapRow(row) : null
}

/**
 * Find a model row by database row ID.
 *
 * @param dbModelId - Database row ID (integer primary key)
 */
export function findById(dbModelId: number): ModelRow | null {
  const row = getDb().select().from(models).where(eq(models.id, dbModelId)).get()
  return row ? mapRow(row) : null
}

/**
 * Resolve an OpenRouter model ID to the database row ID, throwing if missing.
 *
 * @param openRouterModelId - OpenRouter model ID, e.g. "openai/gpt-4o"
 * @returns Database row ID for the model
 */
export function getDbModelId(openRouterModelId: string): number {
  const row = findByOpenRouterId(openRouterModelId)
  if (!row) throw new Error(`Model not found: ${openRouterModelId}`)
  return row.id
}

/**
 * Insert or restore a model in the library.
 *
 * @param openRouterModelId - OpenRouter model ID, e.g. "openai/gpt-4o"
 * @param label - Display name (from OpenRouter or fallback)
 * @param color - Hex color for UI dots/badges, e.g. "#f43f5e"
 */
export function upsertActive(openRouterModelId: string, label: string, color: string): ModelRow {
  const parsed = parseOpenRouterModelId(openRouterModelId.trim())
  if (!parsed) throw new Error(`Invalid OpenRouter model ID: ${openRouterModelId}`)

  const db = getDb()
  const ts = now()
  const existing = db
    .select()
    .from(models)
    .where(and(eq(models.author, parsed.author), eq(models.slug, parsed.slug)))
    .get()

  if (existing) {
    db.update(models)
      .set({ label, color, deletedAt: null })
      .where(eq(models.id, existing.id))
      .run()
    return mapRow({ ...existing, label, color, deletedAt: null })
  }

  const created = db
    .insert(models)
    .values({
      author: parsed.author,
      slug: parsed.slug,
      label,
      color,
      createdAt: ts,
      deletedAt: null
    })
    .returning()
    .get()

  return mapRow(created)
}

/**
 * Ensure a model row exists for a thread assignment (may be soft-deleted).
 *
 * @param openRouterModelId - OpenRouter model ID, e.g. "openai/gpt-4o"
 * @param label - Optional display name override
 */
export function ensureModelRow(openRouterModelId: string, label?: string): ModelRow {
  const existing = findByOpenRouterId(openRouterModelId)
  if (existing) return existing

  const parsed = parseOpenRouterModelId(openRouterModelId.trim())
  if (!parsed) throw new Error(`Invalid OpenRouter model ID: ${openRouterModelId}`)

  const db = getDb()
  const ts = now()
  const created = db
    .insert(models)
    .values({
      author: parsed.author,
      slug: parsed.slug,
      label: label ?? getModelDef(openRouterModelId).label,
      color: getCuratedColorByOpenRouterId(openRouterModelId),
      createdAt: ts,
      deletedAt: ts
    })
    .returning()
    .get()

  return mapRow(created)
}

/**
 * Soft-delete a model from the library. Returns updated active list.
 *
 * @param openRouterModelId - OpenRouter model ID, e.g. "openai/gpt-4o"
 */
export function softDelete(openRouterModelId: string): SavedModel[] {
  const parsed = parseOpenRouterModelId(openRouterModelId.trim())
  if (!parsed) return listActive()

  getDb()
    .update(models)
    .set({ deletedAt: now() })
    .where(and(eq(models.author, parsed.author), eq(models.slug, parsed.slug)))
    .run()

  return listActive()
}

/** Soft-delete every model in the library (e.g. when clearing the API key). */
export function softDeleteAll(): void {
  getDb().update(models).set({ deletedAt: now() }).where(isNull(models.deletedAt)).run()
}

/** Replace the entire active library with the given models. */
export function replaceActive(entries: SavedModel[]): SavedModel[] {
  const db = getDb()
  const ts = now()
  const uniqueEntries = [...new Map(entries.map((m) => [m.openRouterModelId.trim(), m])).values()].filter(
    (m) => m.openRouterModelId
  )

  db.transaction((tx) => {
    tx.update(models).set({ deletedAt: ts }).where(isNull(models.deletedAt)).run()

    uniqueEntries.forEach((entry, index) => {
      const parsed = parseOpenRouterModelId(entry.openRouterModelId)
      if (!parsed) return

      const label = entry.label || getModelDef(entry.openRouterModelId).label
      const color = entry.color || getCuratedColorByOpenRouterId(entry.openRouterModelId)

      const existing = tx
        .select()
        .from(models)
        .where(and(eq(models.author, parsed.author), eq(models.slug, parsed.slug)))
        .get()

      const createdAt = new Date(Date.now() + index).toISOString()

      if (existing) {
        tx.update(models)
          .set({
            label,
            color,
            deletedAt: null,
            createdAt
          })
          .where(eq(models.id, existing.id))
          .run()
      } else {
        tx.insert(models)
          .values({
            author: parsed.author,
            slug: parsed.slug,
            label,
            color,
            createdAt,
            deletedAt: null
          })
          .run()
      }
    })
  })

  return listActive()
}

/**
 * Join helper: load model metadata for a thread's model_id FK.
 *
 * @param dbModelId - Database row ID from threads.model_id
 */
export function getModelForThread(dbModelId: number): { openRouterModelId: string; label: string } {
  const row = findById(dbModelId)
  if (!row) {
    throw new Error(`Model row not found: ${dbModelId}`)
  }
  return { openRouterModelId: toOpenRouterModelId(row), label: row.label }
}

/** All models ordered by creation (for internal use). */
export function listAll(): ModelRow[] {
  return getDb().select().from(models).orderBy(asc(models.createdAt)).all().map(mapRow)
}
