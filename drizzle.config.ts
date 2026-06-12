import { defineConfig } from 'drizzle-kit'

/**
 * drizzle-kit configuration — controls how migration files are generated.
 *
 * Workflow for ANY database change:
 *   1. Edit the schema in electron/db/schema.ts
 *   2. Run `npm run db:generate`
 *   3. Commit the new SQL file that appears in ./drizzle
 * The migration then applies itself automatically on every user's machine the
 * next time they launch the app (see electron/db/client.ts).
 *
 * NOTE: this config is only used at DEV time by the drizzle-kit CLI. It is not
 * bundled into or run by the shipped app.
 */
export default defineConfig({
  dialect: 'sqlite',
  schema: './electron/db/schema.ts',
  out: './drizzle'
})
