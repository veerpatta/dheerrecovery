/**
 * Verify a deployed instance end to end. Accepts a Vercel share link so it can
 * run against a deployment that still has Vercel Authentication enabled.
 *
 * Usage: ENTRY_URL=https://dheerrecovery.vercel.app/ node scripts/live-check.mjs
 *
 * This writes to the real shared record: it marks one dose taken, then undoes
 * it, and logs one BP reading which it leaves in place.
 */
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const ENTRY = process.env.ENTRY_URL
if (!ENTRY) {
  console.error('ENTRY_URL is not set.')
  process.exit(1)
}
const shots = process.env.SHOT_DIR ?? '/tmp/shots'
mkdirSync(shots, { recursive: true })

// Honour an outbound HTTPS proxy when one is configured (CI sandboxes often have one).
const proxyUrl = process.env.HTTPS_PROXY || process.env.https_proxy
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || undefined,
  proxy: proxyUrl ? { server: proxyUrl } : undefined,
})
const ctx = await browser.newContext({
  viewport: { width: 420, height: 900 },
  deviceScaleFactor: 2,
  ignoreHTTPSErrors: Boolean(proxyUrl),
})
const page = await ctx.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(`pageerror @ ${page.url()}: ${e}`))
page.on('response', (r) => r.status() >= 400 && errors.push(`${r.status()} ${r.url()}`))

const out = []
const check = (n, ok, d = '') => {
  out.push(ok)
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${d ? ` — ${d}` : ''}`)
}
const settle = async (ms = 1500) => {
  await page.waitForLoadState('networkidle').catch(() => {})
  await page.waitForTimeout(ms)
}
const body = () => page.locator('body').innerText()

// The deployed app opens straight onto the record — no gate, nothing to create.
await page.goto(ENTRY, { waitUntil: 'networkidle' })
const origin = new URL(page.url()).origin
const today = await body()
check('opens directly onto today', today.includes('Today’s medicines'))
check('seven doses seeded', /\d\/7 taken/.test(today), today.match(/\d\/7 taken/)?.[0])
check(
  'all five routine medicines',
  ['Pantocid‑DSR 40/30', 'Betacap TR 40', 'Lacoset 100', 'Valprol CR 500', 'Tryptomer 10'].every(
    (m) => today.includes(m),
  ),
)

// Write, verify, then undo so a check never leaves a dose it did not observe.
const before = Number((await body()).match(/(\d)\/7 taken/)?.[1] ?? 0)
await page.getByRole('button', { name: /^Taken$/ }).first().click()
await settle()
await page.reload({ waitUntil: 'networkidle' })
check(
  'dose write persisted',
  new RegExp(`${before + 1}/7 taken`).test(await body()),
  (await body()).match(/\d\/7 taken/)?.[0],
)
await page.getByRole('button', { name: /Taken ✓/ }).first().click()
await settle()

// BP through the keypad sheet.
await page.goto(`${origin}/logs`, { waitUntil: 'networkidle' })
await page.getByRole('button', { name: /^Log BP$/ }).first().click()
await page.waitForSelector('[data-bp-key="1"]')
for (const ch of '124') await page.click(`[data-bp-key="${ch}"]`)
await page.click('[data-bp-field="diastolic"]')
for (const ch of '80') await page.click(`[data-bp-key="${ch}"]`)
await page.getByRole('button', { name: /^Save BP$/ }).click()
await settle()
await page.reload({ waitUntil: 'networkidle' })
check('bp write persisted', (await body()).includes('124/80'))

for (const [name, path, needle] of [
  ['chart page', '/chart', 'Lacosamide 100 mg'],
  ['safety page', '/safety', '+91 91161 44111'],
  ['history page', '/history', 'Pantocid‑DSR 40/30'],
  ['settings page', '/settings', 'Routine reminder times'],
  ['report page', '/report', 'Dose ledger'],
]) {
  await page.goto(`${origin}${path}`, { waitUntil: 'networkidle' })
  check(name, (await body()).includes(needle))
}

// Old /c/<code>/… links must still land somewhere useful.
await page.goto(`${origin}/c/Nt2YVS9xDRUqGXFcSX8AbvoS/chart`, {
  waitUntil: 'networkidle',
})
check('legacy care link redirects', new URL(page.url()).pathname === '/chart', page.url())

await page.goto(origin, { waitUntil: 'networkidle' })
await page.screenshot({ path: `${shots}/live-today.png`, fullPage: true })

check('no failed requests or page errors', errors.length === 0, errors.slice(0, 3).join(' | '))
await browser.close()
console.log(`\n${out.filter(Boolean).length}/${out.length} checks passed`)
process.exit(out.every(Boolean) ? 0 : 1)
