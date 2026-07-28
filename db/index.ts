import { neon } from '@neondatabase/serverless'
import { drizzle as drizzleNeon, type NeonHttpDatabase } from 'drizzle-orm/neon-http'
import * as schema from './schema'

type DB = NeonHttpDatabase<typeof schema>

let instance: DB | null = null

/**
 * Neon's HTTP driver is used in production (it works on serverless functions
 * with no connection pool to exhaust). Any other Postgres URL — a local
 * `postgres://localhost/...` during development — falls back to node-postgres,
 * so the app runs without a Neon account.
 */
function connect(): DB {
  const url = process.env.DATABASE_URL
  if (!url) {
    throw new Error(
      'DATABASE_URL is not set. Copy .env.example to .env.local and paste your Neon pooled connection string.',
    )
  }

  if (instance) return instance

  if (/\.neon\.tech|neon\.build/.test(url)) {
    instance = drizzleNeon(neon(url), { schema })
  } else {
    // Required lazily so the Neon-only production bundle never loads `pg`.
    const { drizzle: drizzlePg } = require('drizzle-orm/node-postgres')
    const { Pool } = require('pg')
    instance = drizzlePg(new Pool({ connectionString: url }), {
      schema,
    }) as unknown as DB
  }

  return instance
}

/**
 * Lazy proxy: the connection is only created on first query, so `next build`
 * can import server modules without a database being reachable.
 */
export const db = new Proxy({} as DB, {
  get(_target, prop, receiver) {
    return Reflect.get(connect() as object, prop, receiver)
  },
})

export { schema }
