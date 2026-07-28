/**
 * End-to-end smoke test against a running server.
 * Usage: BASE_URL=http://127.0.0.1:3111 node scripts/smoke.mjs
 *
 * The app opens straight onto the single family record, so this walks the same
 * URLs a caregiver would: no code to enter, no record to create first.
 */
import { chromium } from 'playwright'
import { mkdirSync, statSync } from 'node:fs'

const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:3111'
const shots = process.env.SHOT_DIR ?? '/tmp/shots'
mkdirSync(shots, { recursive: true })

// Only route through a proxy for remote targets — sending localhost through
// one makes every request fail in a way that looks like a broken app.
const isLocal = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:|\/|$)/.test(BASE)
const proxyUrl = isLocal ? null : process.env.HTTPS_PROXY || process.env.https_proxy

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || undefined,
  proxy: proxyUrl ? { server: proxyUrl, bypass: 'localhost,127.0.0.1' } : undefined,
})
const ctx = await browser.newContext({
  viewport: { width: 420, height: 900 },
  deviceScaleFactor: 2,
  acceptDownloads: true,
  ignoreHTTPSErrors: Boolean(proxyUrl),
})
const page = await ctx.newPage()

const results = []
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
}

/** Server Actions trigger a router refresh; wait for it before asserting. */
const settle = async (ms = 400) => {
  await page.waitForLoadState('networkidle').catch(() => {})
  await page.waitForTimeout(ms)
}

const errors = []
const expected404 = []
page.on('pageerror', (e) => errors.push(`pageerror @ ${page.url()}: ${e}`))
page.on('response', (r) => {
  if (r.status() < 400) return
  if (expected404.some((u) => r.url().includes(u))) return
  errors.push(`${r.status()} ${r.url()} (from ${page.url()})`)
})

const text = () => page.locator('body').innerText()

// 1. The app opens straight onto today — no gate of any kind.
await page.goto(BASE, { waitUntil: 'networkidle' })
check('opens directly onto today', (await text()).includes('Today’s medicines'))
check('no code entry anywhere', !/care code|sync code|Create care record/i.test(await text()))
const body = await text()
for (const med of [
  'Pantocid‑DSR 40/30',
  'Betacap TR 40',
  'Lacoset 100',
  'Valprol CR 500',
  'Tryptomer 10',
]) {
  check(`today lists ${med}`, body.includes(med))
}
check('7 scheduled doses', /0\/7 taken/.test(body), body.match(/\d+\/\d+ taken/)?.[0])
check('prescription date on today', body.includes('28 July 2026'))
check('bottom nav present', (await page.locator('nav a[href="/logs"]').count()) === 1)
await page.screenshot({ path: `${shots}/01-today.png`, fullPage: true })

// 2. Verify banner
await page.getByRole('button', { name: /I checked the new prescription/i }).click()
await settle()
check('verify banner clears', !/VERIFY BEFORE FIRST USE/i.test(await text()))

// 3. Mark a dose taken -> persists across reload
await page.getByRole('button', { name: /^Taken$/ }).first().click()
await settle()
await page.reload({ waitUntil: 'networkidle' })
const afterTake = await text()
check('dose persisted as taken', /1\/7 taken/.test(afterTake), afterTake.match(/\d+\/\d+ taken/)?.[0])

// 4. Undo
await page.getByRole('button', { name: /Taken ✓/ }).first().click()
await settle()
await page.reload({ waitUntil: 'networkidle' })
check('undo clears record', /0\/7 taken/.test(await text()))
await page.getByRole('button', { name: /^Taken$/ }).first().click()
await settle()

// 5. SOS drawer
await page.getByRole('button', { name: /^SOS/ }).click()
await page.waitForSelector('text=Outside the routine schedule')
const sosText = await page.locator('[role=dialog]').innerText()
for (const m of ['Napra‑D 500/10', 'Zytee Gel LA', 'Dolo', 'Looz syrup', 'ORS / safe fluids']) {
  check(`sos lists ${m}`, sosText.includes(m))
}
await page.waitForTimeout(600) // let the sheet finish sliding up
await page.screenshot({ path: `${shots}/02-sos.png` })
await page.keyboard.press('Escape')
await page.waitForTimeout(500)
check('sos drawer closes on Escape', (await page.locator('[role=dialog]').count()) === 0)

// 6. Chart
await page.goto(`${BASE}/chart`, { waitUntil: 'networkidle' })
const chartText = await text()
check(
  'chart shows generics',
  chartText.includes('Lacosamide 100 mg') &&
    chartText.includes('Propranolol 40 mg modified-release'),
)
check('chart shows cautions', chartText.includes('double vision'))
check('chart shows Hindi rx', chartText.includes('दिन में 2 बार'))
await page.screenshot({ path: `${shots}/03-chart.png`, fullPage: true })

// 7. Safety
await page.goto(`${BASE}/safety`, { waitUntil: 'networkidle' })
const safetyText = await text()
check(
  'emergency numbers',
  safetyText.includes('+91 91161 44111') && safetyText.includes('+91 294 666 9999'),
)
check('safety rules', safetyText.includes('Never double a missed dose'))

// 8. BP — entered on the keypad sheet, one tap per digit
await page.goto(`${BASE}/logs`, { waitUntil: 'networkidle' })
const typePad = async (value) => {
  for (const ch of String(value)) await page.click(`[data-bp-key="${ch}"]`)
}
for (const [s, d, p] of [[126, 82, 74], [122, 79, 72], [148, 94, 88]]) {
  await page.getByRole('button', { name: /^Log BP$/ }).first().click()
  await page.waitForSelector('[data-bp-key="1"]')
  await typePad(s)
  await page.click('[data-bp-field="diastolic"]')
  await typePad(d)
  await page.click('[data-bp-field="pulse"]')
  await typePad(p)
  if (s === 126) await page.screenshot({ path: `${shots}/08-bp-sheet.png` })
  await page.getByRole('button', { name: /^Save BP$/ }).click()
  await settle()
  check(`bp sheet closes after saving ${s}/${d}`, (await page.locator('[role=dialog]').count()) === 0)
}
await page.reload({ waitUntil: 'networkidle' })
const logsText = await text()
check('bp readings saved', logsText.includes('148/94') && logsText.includes('126/82'))
check('bp latest shown', /LATEST[\s\S]{0,60}148\/94/i.test(logsText))
await page.screenshot({ path: `${shots}/04-logs.png`, fullPage: true })

// 9. Seizure + note
await page.fill('textarea[name=description]', 'Brief episode, settled on its own.')
await page.fill('input[name=durationMinutes]', '2')
await page.getByRole('button', { name: /Save seizure event/i }).click()
await settle()
await page.fill('textarea[name=body]', 'Ate well, slept through the night.')
await page.getByRole('button', { name: /Save caregiver note/i }).click()
await settle()
await page.reload({ waitUntil: 'networkidle' })
const logs2 = await text()
check('seizure saved', logs2.includes('settled on its own'))
check('note saved', logs2.includes('slept through the night'))

// 10. History
await page.goto(`${BASE}/history`, { waitUntil: 'networkidle' })
const histText = await text()
check(
  'history shows ledger',
  /DAILY CARE LEDGER/i.test(histText) && histText.includes('Pantocid‑DSR 40/30'),
)
check('history counts taken', /TAKEN\n+1\b/i.test(histText), histText.match(/TAKEN\n+\d+/i)?.[0]?.replace(/\n+/g, ' '))
check('history shows the dose map', /EVERY DOSE AT A GLANCE/i.test(histText))
check('history shows on-time score', /ON-TIME SCORE/i.test(histText) && /PERFECT DAYS/i.test(histText))
check(
  'history totals salt intake',
  /MEDICINE INTAKE/i.test(histText) && /Pantoprazole/.test(histText),
)
await page.screenshot({ path: `${shots}/06-history.png`, fullPage: true })

// 11. Settings — reminder times, and no sync UI left
await page.goto(`${BASE}/settings`, { waitUntil: 'networkidle' })
const setText = await text()
check('no sync card', !/sync code|Share caregiver link|Copy code/i.test(setText))
check('alert-speed chips', /ALERT SPEED/i.test(setText) && /10 minutes/.test(setText))
check(
  'betacap printed time is not editable',
  /8:00 am/i.test(setText),
  'shown as static text, not an input',
)
const timeInputs = page.locator('input[type=time]')
check('editable reminder slots', (await timeInputs.count()) >= 6, `${await timeInputs.count()} inputs`)
await page.screenshot({ path: `${shots}/05-settings.png`, fullPage: true })
await timeInputs.first().fill('07:30')
await settle(800)
await page.goto(BASE, { waitUntil: 'networkidle' })
check('reminder time updated', (await text()).includes('7:30 am'))
await page.screenshot({ path: `${shots}/07-today-after.png`, fullPage: true })

// 12. Report
await page.goto(`${BASE}/report`, { waitUntil: 'networkidle' })
check('report renders', (await text()).includes('Dose ledger'))

// 13. XLSX
const dl = await Promise.all([
  page.waitForEvent('download', { timeout: 30000 }),
  page.goto(`${BASE}/export/xlsx`).catch(() => {}),
]).then((r) => r[0])
check(
  'xlsx downloads',
  statSync(await dl.path()).size > 8000,
  `${statSync(await dl.path()).size} bytes as ${dl.suggestedFilename()}`,
)

// 14. Old /c/<code>/… links still land somewhere useful
await page.goto(`${BASE}/c/Nt2YVS9xDRUqGXFcSX8AbvoS/chart`, { waitUntil: 'networkidle' })
check('legacy care link redirects', new URL(page.url()).pathname === '/chart', page.url())

// 15. A genuinely unknown path still 404s
expected404.push('/no-such-page')
const resp = await page.goto(`${BASE}/no-such-page`, { waitUntil: 'networkidle' })
check('unknown path 404s', resp.status() === 404, `status ${resp.status()}`)

check('no failed requests or page errors', errors.length === 0, errors.slice(0, 4).join(' | '))

await browser.close()

const failed = results.filter((r) => !r.ok)
console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
process.exit(failed.length ? 1 : 0)
