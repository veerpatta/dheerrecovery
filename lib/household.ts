import 'server-only'
import { asc } from 'drizzle-orm'
import { cache } from 'react'
import { db } from '@/db'
import { households, type Household } from '@/db/schema'
import { createHousehold, findHousehold } from './queries'

/**
 * The app serves one family record and opens straight onto it — no code to
 * enter, no link to keep. This resolves which row that is.
 *
 * The care code column stays in the schema: it is what the Sites migration
 * keyed the imported record on, and dropping it would strand that data. It is
 * simply no longer part of the URL or the UI.
 */

/** The record migrated from the original Sites app. */
const MIGRATED_CARE_CODE = 'Nt2YVS9xDRUqGXFcSX8AbvoS'

/**
 * Resolution order, most specific first, so a fresh database still works and a
 * populated one can never silently pick the wrong record:
 *
 *   1. PRIMARY_CARE_CODE, if set — the explicit override.
 *   2. The migrated family record.
 *   3. The oldest household present, if the two above are missing.
 *   4. Otherwise seed a new record from the prescription catalogue.
 *
 * `cache` scopes this to one request, so a page that renders the layout, the
 * nav and three sections issues one lookup rather than five.
 */
export const getHousehold = cache(async (): Promise<Household> => {
  const pinned = process.env.PRIMARY_CARE_CODE?.trim()

  for (const code of [pinned, MIGRATED_CARE_CODE]) {
    if (!code) continue
    const found = await findHousehold(code)
    if (found) return found
  }

  const [oldest] = await db
    .select()
    .from(households)
    .orderBy(asc(households.createdAt))
    .limit(1)
  if (oldest) return oldest

  return createHousehold(pinned || MIGRATED_CARE_CODE)
})
