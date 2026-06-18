/**
 * Saved model library — CRUD for the `models` table.
 *
 * The user's model library lives in SQLite (not settings.json). Threads reference
 * models by integer FK; this repo exposes OpenRouter slug strings at the boundary.
 */
import { and, asc, desc, eq, isNull } from 'drizzle-orm'
import { formatModelSlug, getModelDef, parseModelSlug } from '@shared/models'
import { getDb } from '../client'
import { models } from '../schema'

const now = () => new Date().toISOString()

export interface ModelRow {
  id: number
  author: string
  slug: string
  label: string
  createdAt: string
  deletedAt: string | null
}

function toSlug(row: { author: string; slug: string }): string {
  return formatModelSlug(row.author, row.slug)
}

function mapRow(row: typeof models.$inferSelect): ModelRow {
  return {
    id: row.id,
    author: row.author,
    slug: row.slug,
    label: row.label,
    createdAt: row.createdAt,
    deletedAt: row.deletedAt
  }
}

/** Active library slugs, newest first. */
export function listActiveSlugs(): string[] {
  const db = getDb()
  const rows = db
    .select()
    .from(models)
    .where(isNull(models.deletedAt))
    .orderBy(desc(models.createdAt))
    .all()

  return rows.map((row) => toSlug(row))
}

/** Find a model row by full OpenRouter id. */
export function findBySlug(fullId: string): ModelRow | null {
  const parsed = parseModelSlug(fullId.trim())
  if (!parsed) return null

  const row = getDb()
    .select()
    .from(models)
    .where(and(eq(models.author, parsed.author), eq(models.slug, parsed.slug)))
    .get()

  return row ? mapRow(row) : null
}

/** Find a model row by internal id. */
export function findById(id: number): ModelRow | null {
  const row = getDb().select().from(models).where(eq(models.id, id)).get()
  return row ? mapRow(row) : null
}

/** Resolve a slug to the internal model id, throwing if missing. */
export function requireModelId(fullId: string): number {
  const row = findBySlug(fullId)
  if (!row) throw new Error(`Model not found: ${fullId}`)
  return row.id
}

/**
 * Insert or restore a model in the library.
 * @param fullId OpenRouter model id
 * @param label Display name (from OpenRouter or fallback)
 */
export function upsertActive(fullId: string, label: string): ModelRow {
  const parsed = parseModelSlug(fullId.trim())
  if (!parsed) throw new Error(`Invalid model id: ${fullId}`)

  const db = getDb()
  const ts = now()
  const existing = db
    .select()
    .from(models)
    .where(and(eq(models.author, parsed.author), eq(models.slug, parsed.slug)))
    .get()

  if (existing) {
    db.update(models)
      .set({ label, deletedAt: null })
      .where(eq(models.id, existing.id))
      .run()
    return mapRow({ ...existing, label, deletedAt: null })
  }

  const created = db
    .insert(models)
    .values({
      author: parsed.author,
      slug: parsed.slug,
      label,
      createdAt: ts,
      deletedAt: null
    })
    .returning()
    .get()

  return mapRow(created)
}

/** Ensure a model row exists for a thread assignment (may be soft-deleted). */
export function ensureModelRow(fullId: string, label?: string): ModelRow {
  const existing = findBySlug(fullId)
  if (existing) return existing

  const parsed = parseModelSlug(fullId.trim())
  if (!parsed) throw new Error(`Invalid model id: ${fullId}`)

  const db = getDb()
  const ts = now()
  const created = db
    .insert(models)
    .values({
      author: parsed.author,
      slug: parsed.slug,
      label: label ?? getModelDef(fullId).label,
      createdAt: ts,
      deletedAt: ts
    })
    .returning()
    .get()

  return mapRow(created)
}

/** Soft-delete a model from the library. Returns updated active slug list. */
export function softDelete(fullId: string): string[] {
  const parsed = parseModelSlug(fullId.trim())
  if (!parsed) return listActiveSlugs()

  getDb()
    .update(models)
    .set({ deletedAt: now() })
    .where(and(eq(models.author, parsed.author), eq(models.slug, parsed.slug)))
    .run()

  return listActiveSlugs()
}

/** Soft-delete every model in the library (e.g. when clearing the API key). */
export function softDeleteAll(): void {
  getDb().update(models).set({ deletedAt: now() }).where(isNull(models.deletedAt)).run()
}

/** Replace the entire active library with the given slug list. */
export function replaceActive(fullIds: string[]): string[] {
  const db = getDb()
  const ts = now()
  const uniqueIds = [...new Set(fullIds.map((id) => id.trim()).filter(Boolean))]

  db.transaction((tx) => {
    tx.update(models).set({ deletedAt: ts }).where(isNull(models.deletedAt)).run()

    uniqueIds.forEach((fullId, index) => {
      const parsed = parseModelSlug(fullId)
      if (!parsed) return

      const existing = tx
        .select()
        .from(models)
        .where(and(eq(models.author, parsed.author), eq(models.slug, parsed.slug)))
        .get()

      const createdAt = new Date(Date.now() + index).toISOString()

      if (existing) {
        tx.update(models)
          .set({
            label: getModelDef(fullId).label,
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
            label: getModelDef(fullId).label,
            createdAt,
            deletedAt: null
          })
          .run()
      }
    })
  })

  return listActiveSlugs()
}

/** Join helper: load model metadata for a thread's model_id FK. */
export function getModelForThread(modelRowId: number): { modelId: string; label: string } {
  const row = findById(modelRowId)
  if (!row) {
    throw new Error(`Model row not found: ${modelRowId}`)
  }
  return { modelId: toSlug(row), label: row.label }
}

/** All models ordered by creation (for internal use). */
export function listAll(): ModelRow[] {
  return getDb().select().from(models).orderBy(asc(models.createdAt)).all().map(mapRow)
}
