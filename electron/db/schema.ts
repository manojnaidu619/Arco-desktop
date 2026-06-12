/**
 * Database schema (Drizzle ORM, SQLite).
 *
 * Three tables form a simple hierarchy:
 *   sessions  →  threads  →  messages
 *
 *   • A SESSION is one conversation tab (what you see in the sidebar).
 *   • A THREAD is one model's column within a session.
 *   • A MESSAGE is a single user or assistant turn within a thread.
 *
 * Deletes cascade downward: removing a session removes its threads, which
 * removes their messages (enforced by the foreign keys + `PRAGMA
 * foreign_keys = ON`, set when the connection opens — see client.ts).
 */
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

export const sessions = sqliteTable('sessions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  /** Sidebar label; null until the first message sets it. */
  title: text('title'),
  /** Grid layout = number of visible panes (1|2|3|4|6). Default 4. */
  layout: integer('layout').notNull().default(4),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  /** Exactly one session is active at a time (the one currently open). */
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true)
})

export const threads = sqliteTable('threads', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  sessionId: integer('session_id')
    .notNull()
    .references(() => sessions.id, { onDelete: 'cascade' }),
  /** Grid position 0..5 — the pane's stable identity within the session. */
  slot: integer('slot').notNull().default(0),
  /** OpenRouter model id this pane talks to. */
  modelId: text('model_id').notNull(),
  /** Display label captured at creation time. */
  label: text('label').notNull(),
  createdAt: text('created_at').notNull()
})

export const messages = sqliteTable('messages', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  threadId: integer('thread_id')
    .notNull()
    .references(() => threads.id, { onDelete: 'cascade' }),
  role: text('role', { enum: ['user', 'assistant'] }).notNull(),
  content: text('content').notNull(),
  /** 0-based order of the message within its thread. */
  seq: integer('seq').notNull(),
  createdAt: text('created_at').notNull()
})
