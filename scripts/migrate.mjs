/**
 * Apply migrations over Neon's HTTP driver.
 *
 * `drizzle-kit migrate` connects on TCP 5432, which is blocked on plenty of
 * CI runners and sandboxes. This does the same work over HTTPS, and keeps
 * drizzle's own `__drizzle_migrations` bookkeeping so the two stay in sync.
 *
 * Usage: DATABASE_URL="postgres://…" node scripts/migrate.mjs
 */
import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import { migrate } from 'drizzle-orm/neon-http/migrator'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const url = process.env.DATABASE_URL
if (!url) {
  console.error('DATABASE_URL is not set.')
  process.exit(1)
}

const here = dirname(fileURLToPath(import.meta.url))
const migrationsFolder = resolve(here, '../db/migrations')

const db = drizzle(neon(url))
await migrate(db, { migrationsFolder })

console.log('migrations applied')
