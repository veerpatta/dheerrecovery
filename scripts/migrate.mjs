/**
 * Apply migrations, over Neon's HTTP driver when the URL is a Neon one.
 *
 * `drizzle-kit migrate` connects on TCP 5432, which is blocked on plenty of
 * CI runners and sandboxes. Against Neon this does the same work over HTTPS,
 * and keeps drizzle's own `__drizzle_migrations` bookkeeping so the two stay
 * in sync.
 *
 * Any other Postgres URL — a local `postgres://localhost/…` during
 * development — falls back to node-postgres, mirroring `db/index.ts`, so the
 * documented `npm run db:migrate` works without a Neon account.
 *
 * Usage: DATABASE_URL="postgres://…" node scripts/migrate.mjs
 */
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const url = process.env.DATABASE_URL
if (!url) {
  console.error('DATABASE_URL is not set.')
  process.exit(1)
}

const here = dirname(fileURLToPath(import.meta.url))
const migrationsFolder = resolve(here, '../db/migrations')

if (/\.neon\.tech|neon\.build/.test(url)) {
  const { neon } = await import('@neondatabase/serverless')
  const { drizzle } = await import('drizzle-orm/neon-http')
  const { migrate } = await import('drizzle-orm/neon-http/migrator')
  await migrate(drizzle(neon(url)), { migrationsFolder })
} else {
  const { drizzle } = await import('drizzle-orm/node-postgres')
  const { migrate } = await import('drizzle-orm/node-postgres/migrator')
  const { default: pg } = await import('pg')
  const pool = new pg.Pool({ connectionString: url })
  await migrate(drizzle(pool), { migrationsFolder })
  await pool.end()
}

console.log('migrations applied')
