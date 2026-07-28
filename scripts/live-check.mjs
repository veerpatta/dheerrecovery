/**
 * Verify a deployed instance end to end. Accepts a Vercel share link so it can
 * run against a deployment that still has Vercel Authentication enabled.
 */
import { chromium } from 'playwright'

const ENTRY = process.env.ENTRY_URL
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
const check = (n, ok, d = '') => { out.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${d ? ` — ${d}` : ''}`) }

await page.goto(ENTRY, { waitUntil: 'networkidle' })
const origin = new URL(page.url()).origin
check('landing loads', (await page.locator('body').innerText()).includes('Dheer Recovery Medicines'))

await page.getByRole('button', { name: /Create care record/i }).click()
await page.waitForURL(/\/c\/[A-Z0-9]+$/, { timeout: 40000 })
const code = page.url().split('/c/')[1]
check('record created on Neon', /^[A-Z0-9]{20}$/.test(code), code)

const today = await page.locator('body').innerText()
check('seven doses seeded', /0\/7 taken/.test(today))
check('all five routine medicines', ['Pantocid‑DSR 40/30','Betacap TR 40','Lacoset 100','Valprol CR 500','Tryptomer 10'].every(m => today.includes(m)))

await page.getByRole('button', { name: /^Taken$/ }).first().click()
await page.waitForLoadState('networkidle').catch(()=>{})
await page.waitForTimeout(1500)
await page.reload({ waitUntil: 'networkidle' })
check('dose write persisted', /1\/7 taken/.test(await page.locator('body').innerText()))

await page.goto(`${origin}/c/${code}/logs`, { waitUntil: 'networkidle' })
await page.fill('input[name=systolic]', '124')
await page.fill('input[name=diastolic]', '80')
await page.getByRole('button', { name: /Save BP/i }).click()
await page.waitForLoadState('networkidle').catch(()=>{})
await page.waitForTimeout(1500)
await page.reload({ waitUntil: 'networkidle' })
check('bp write persisted', (await page.locator('body').innerText()).includes('124/80'))

for (const [name, path, needle] of [
  ['chart page', '/chart', 'Lacosamide 100 mg'],
  ['safety page', '/safety', '+91 91161 44111'],
  ['history page', '/history', 'Pantocid‑DSR 40/30'],
  ['settings page', '/settings', 'Family sync'],
  ['report page', '/report', 'Dose ledger'],
]) {
  await page.goto(`${origin}/c/${code}${path}`, { waitUntil: 'networkidle' })
  check(name, (await page.locator('body').innerText()).includes(needle))
}

await page.screenshot({ path: '/root/out/live-today.png', fullPage: false })
await page.goto(`${origin}/c/${code}`, { waitUntil: 'networkidle' })
await page.screenshot({ path: '/root/out/live-today.png', fullPage: true })

check('no failed requests or page errors', errors.length === 0, errors.slice(0,3).join(' | '))
await browser.close()
console.log(`\n${out.filter(Boolean).length}/${out.length} checks passed`)
console.log(`TEST_CODE=${code}`)
process.exit(out.every(Boolean) ? 0 : 1)
