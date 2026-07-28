/**
 * End-to-end smoke test against a running server.
 * Usage: BASE_URL=http://127.0.0.1:3111 node scripts/smoke.mjs
 */
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:3111'
const shots = process.env.SHOT_DIR ?? '/tmp/shots'
mkdirSync(shots, { recursive: true })

const results = []
/** Server Actions trigger a router refresh; wait for it before asserting. */
const settle = async (ms = 400) => {
  await page.waitForLoadState('networkidle').catch(() => {})
  await page.waitForTimeout(ms)
}

const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
}

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || undefined,
})
const ctx = await browser.newContext({
  viewport: { width: 420, height: 900 },
  deviceScaleFactor: 2,
  acceptDownloads: true,
})
const page = await ctx.newPage()
const errors = []
const expected404 = []
page.on('pageerror', (e) => errors.push(`pageerror @ ${page.url()}: ${e}`))
// Dev builds surface the full hydration diff as a console error.
page.on('console', (m) => {
  if (m.type() !== 'error') return
  const text = m.text()
  if (/hydrat|did not match|server rendered/i.test(text)) {
    errors.push(`hydration @ ${page.url()}: ${text.slice(0, 900)}`)
  }
})
page.on('response', (r) => {
  if (r.status() < 400) return
  // The unknown-code check below deliberately requests a 404 page.
  if (expected404.some((u) => r.url().includes(u))) return
  errors.push(`${r.status()} ${r.url()} (from ${page.url()})`)
})

// 1. Landing -> create record
await page.goto(BASE, { waitUntil: 'networkidle' })
check('landing renders', await page.getByRole('heading', { name: /Dheer Recovery/i }).isVisible())
await page.screenshot({ path: `${shots}/01-landing.png`, fullPage: true })

await page.getByRole('button', { name: /Create care record/i }).click()
await page.waitForURL(/\/c\/[A-Z0-9]+$/, { timeout: 20000 })
const careUrl = page.url()
const code = careUrl.split('/c/')[1]
check('care record created', /^[A-Z0-9]{20}$/.test(code), code)

// 2. Today page content
await page.waitForSelector('text=Today’s medicines')
const bodyText = await page.locator('body').innerText()
for (const med of [
  'Pantocid‑DSR 40/30',
  'Betacap TR 40',
  'Lacoset 100',
  'Valprol CR 500',
  'Tryptomer 10',
]) {
  check(`today lists ${med}`, bodyText.includes(med))
}
check('7 scheduled doses', /0\/7 taken/.test(bodyText), bodyText.match(/\d+\/\d+ taken/)?.[0])
check(
  'prescription header',
  bodyText.includes('Dr Ajit Singh') && bodyText.includes('28 July 2026'),
)
await page.screenshot({ path: `${shots}/02-today.png`, fullPage: true })

// 3. Verify banner
await page.getByRole('button', { name: /I checked the new prescription/i }).click()
await settle()
check(
  'verify banner clears',
  !(await page.locator('body').innerText()).includes('VERIFY BEFORE FIRST USE') &&
    !(await page.locator('body').innerText()).includes('Verify before first use'),
)

// 4. Mark a dose taken -> persists across reload
const takenButtons = page.getByRole('button', { name: /^Taken$/ })
await takenButtons.first().click()
await settle()
await page.reload({ waitUntil: 'networkidle' })
const afterTake = await page.locator('body').innerText()
check('dose persisted as taken', /1\/7 taken/.test(afterTake), afterTake.match(/\d+\/\d+ taken/)?.[0])

// 5. Undo
await page.getByRole('button', { name: /Taken ✓/ }).first().click()
await settle()
await page.reload({ waitUntil: 'networkidle' })
check('undo clears record', /0\/7 taken/.test(await page.locator('body').innerText()))
// re-take so later pages have data
await page.getByRole('button', { name: /^Taken$/ }).first().click()
await settle()

// 6. SOS drawer
await page.getByRole('button', { name: /^SOS/ }).click()
await page.waitForSelector('text=Outside the routine schedule')
const sosText = await page.locator('[role=dialog]').innerText()
for (const m of ['Napra‑D 500/10', 'Zytee Gel LA', 'Dolo', 'Looz syrup', 'ORS / safe fluids']) {
  check(`sos lists ${m}`, sosText.includes(m))
}
await page.screenshot({ path: `${shots}/03-sos.png` })
await page.keyboard.press('Escape')
await page.waitForTimeout(500)
check('sos drawer closes on Escape', (await page.locator('[role=dialog]').count()) === 0)

// 7. Chart page
await page.goto(`${careUrl}/chart`, { waitUntil: 'networkidle' })
const chartText = await page.locator('body').innerText()
check('chart shows generics', chartText.includes('Lacosamide 100 mg') && chartText.includes('Propranolol 40 mg modified-release'))
check('chart shows cautions', chartText.includes('double vision'))
check('chart shows Hindi rx', chartText.includes('दिन में 2 बार'))
await page.screenshot({ path: `${shots}/04-chart.png`, fullPage: true })

// 8. Safety page
await page.goto(`${careUrl}/safety`, { waitUntil: 'networkidle' })
const safetyText = await page.locator('body').innerText()
check('emergency numbers', safetyText.includes('+91 91161 44111') && safetyText.includes('+91 294 666 9999'))
check('safety rules', safetyText.includes('Never double a missed dose'))
await page.screenshot({ path: `${shots}/05-safety.png`, fullPage: true })

// 9. Log BP twice (paired session)
await page.goto(`${careUrl}/logs`, { waitUntil: 'networkidle' })
for (const [s, d, p] of [[126, 82, 74], [122, 79, 72], [148, 94, 88]]) {
  await page.fill('input[name=systolic]', String(s))
  await page.fill('input[name=diastolic]', String(d))
  await page.fill('input[name=pulse]', String(p))
  await page.getByRole('button', { name: /Save BP/i }).click()
  await settle()
}
await page.reload({ waitUntil: 'networkidle' })
const logsText = await page.locator('body').innerText()
check('bp readings saved', logsText.includes('148/94') && logsText.includes('126/82'))
// `.eyebrow` uppercases via CSS, and innerText reflects the rendered casing.
check('bp latest shown', /LATEST[\s\S]{0,60}148\/94/i.test(logsText))
check('bp average computed', /\d+\/\d+/.test(logsText.split('AVERAGE')[1] ?? ''))
await page.screenshot({ path: `${shots}/06-logs.png`, fullPage: true })

// 10. Seizure + note
await page.fill('textarea[name=description]', 'Brief episode, settled on its own.')
await page.fill('input[name=durationMinutes]', '2')
await page.getByRole('button', { name: /Save seizure event/i }).click()
await settle()
await page.fill('textarea[name=body]', 'Ate well, slept through the night.')
await page.getByRole('button', { name: /Save caregiver note/i }).click()
await settle()
await page.reload({ waitUntil: 'networkidle' })
const logs2 = await page.locator('body').innerText()
check('seizure saved', logs2.includes('settled on its own'))
check('note saved', logs2.includes('slept through the night'))

// 11. History page
await page.goto(`${careUrl}/history`, { waitUntil: 'networkidle' })
const histText = await page.locator('body').innerText()
check(
  'history shows ledger',
  /DAILY CARE LEDGER/i.test(histText) && histText.includes('Pantocid‑DSR 40/30'),
)
check('history counts completion', /LOG COMPLETION/i.test(histText))
check('history counts taken', /TAKEN\n+1\b/i.test(histText), histText.match(/TAKEN\n+\d+/i)?.[0]?.replace(/\n+/g, ' '))
await page.screenshot({ path: `${shots}/07-history.png`, fullPage: true })

// 12. Settings + reminder times
await page.goto(`${careUrl}/settings`, { waitUntil: 'networkidle' })
const setText = await page.locator('body').innerText()
const shownCode = await page.locator('input[readonly]').first().inputValue()
check('sync code visible', shownCode === code.match(/.{1,5}/g).join('-'), shownCode)
const timeInputs = page.locator('input[type=time]')
check('editable reminder slots', (await timeInputs.count()) >= 6, `${await timeInputs.count()} inputs`)
await timeInputs.first().fill('07:30')
await settle(800)
await page.goto(`${careUrl}`, { waitUntil: 'networkidle' })
check('reminder time updated', (await page.locator('body').innerText()).includes('7:30 am'))
await page.goto(`${careUrl}/settings`, { waitUntil: 'networkidle' })
await page.screenshot({ path: `${shots}/08-settings.png`, fullPage: true })

// 13. Report page
await page.goto(`${careUrl}/report`, { waitUntil: 'networkidle' })
const repText = await page.locator('body').innerText()
check('report renders', repText.includes('medicine & recovery record') && repText.includes('Dose ledger'))
await page.screenshot({ path: `${shots}/09-report.png`, fullPage: true })

// 14. XLSX export
const dl = await Promise.all([
  page.waitForEvent('download', { timeout: 30000 }),
  page.goto(`${careUrl}/export/xlsx`).catch(() => {}),
]).then((r) => r[0])
const path = await dl.path()
const { statSync } = await import('node:fs')
check('xlsx downloads', statSync(path).size > 8000, `${statSync(path).size} bytes as ${dl.suggestedFilename()}`)

// 15. Bad code -> not found
expected404.push('/c/AAAAAAAAAAAAAAAAAAAA')
const resp = await page.goto(`${BASE}/c/AAAAAAAAAAAAAAAAAAAA`, { waitUntil: 'networkidle' })
check('unknown code 404s', resp.status() === 404, `status ${resp.status()}`)

check('no failed requests or page errors', errors.length === 0, errors.slice(0, 4).join(' | '))

await browser.close()

const failed = results.filter((r) => !r.ok)
console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
console.log(`care code for manual review: ${code}`)
process.exit(failed.length ? 1 : 0)
