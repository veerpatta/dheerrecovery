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
  // Every day of the chemoradiation course. Temozolomide and Septran DS are
  // deliberately absent from this list: one waits on the therapy answer, the
  // other on the weekday, and both are asserted properly further down.
  'Perinorm 10',
]) {
  check(`today lists ${med}`, body.includes(med))
}

/*
 * The scheduled total is no longer a constant. Septran DS is Mondays and
 * Thursdays, Temozolomide lands only on a day answered as a therapy day, and
 * the whole chemoradiation course ends on 26 October — so a fresh database
 * shows nine, eleven or seven depending on the day this runs. Read the total
 * off the page once and make every later assertion relative to it; that is a
 * stronger test than a hard-coded number was, and it survives a Monday.
 */
const total = Number(body.match(/\d+\/(\d+) taken/)?.[1])
const ring = (n) => new RegExp(`${n}/${total} taken`)
check('scheduled doses seeded', total >= 7, `${total} slots`)
check('nothing recorded yet', ring(0).test(body), body.match(/\d+\/\d+ taken/)?.[0])
check('prescription date on today', body.includes('28 July 2026'))
check('bottom nav present', (await page.locator('nav a[href="/logs"]').count()) === 1)

// The floating stack must clear the last item rather than sitting on top of it.
await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
await page.waitForTimeout(300)
const tail = await page.locator('main > p').last().boundingBox()
const fab = await page.getByRole('button', { name: /^Log BP$/ }).last().boundingBox()
check(
  'floating buttons clear the last item',
  tail.y + tail.height <= fab.y + 4,
  `tail ends ${Math.round(tail.y + tail.height)}, fab starts ${Math.round(fab.y)}`,
)
await page.evaluate(() => window.scrollTo(0, 0))
await page.screenshot({ path: `${shots}/01-today.png`, fullPage: true })

// 2. Verify banner
await page.getByRole('button', { name: /I checked the new prescription/i }).click()
await settle()
check('verify banner clears', !/VERIFY BEFORE FIRST USE/i.test(await text()))

// 2b. Every card carries its basics without being opened
const firstCard = page.locator('li', { hasText: 'Pantocid‑DSR 40/30' }).first()
const firstCardText = await firstCard.innerText()
check(
  'card shows what the medicine is for, unopened',
  /Reduces stomach acid/i.test(firstCardText),
)
check('card shows the category chip', /Recovery/i.test(firstCardText))
check('card shows a food rule chip', /Before food/i.test(firstCardText))
check(
  'long clinical text stays behind the disclosure',
  !/heart rhythm/i.test(firstCardText),
)

// 3. Mark a dose taken — the time dialog stands in the way now
await page.getByRole('button', { name: /^Taken$/ }).first().click()
await page.waitForSelector('[role=dialog]')
check('taken opens the time dialog', (await page.locator('[role=dialog]').count()) === 1)
const doseSheet = await page.locator('[role=dialog]').innerText()
check('time dialog shows the due time', /Due /i.test(doseSheet))
check('time dialog offers relative chips', /15m ago/.test(doseSheet))
await page.waitForTimeout(500)
await page.screenshot({ path: `${shots}/11-dose-time.png` })
await page.getByRole('button', { name: /^Taken now$/ }).click()
await settle()
check('time dialog closes after saving', (await page.locator('[role=dialog]').count()) === 0)
await page.reload({ waitUntil: 'networkidle' })
const afterTake = await text()
check('dose persisted as taken', ring(1).test(afterTake), afterTake.match(/\d+\/\d+ taken/)?.[0])

// 4. A recorded dose offers no decision — the buttons step aside entirely,
//    and the correction lives behind the disclosure instead.
const takenCard = page.locator('li', { hasText: 'Pantocid‑DSR 40/30' }).first()
check(
  'taken card drops the Taken button',
  (await takenCard.getByRole('button', { name: /^Taken$/ }).count()) === 0,
)
check(
  'taken card drops the Skip button',
  (await takenCard.getByRole('button', { name: /^Skip$/ }).count()) === 0,
)
check('taken card has no undo', !/undo/i.test(await takenCard.innerText()))
check('taken card stamps the time it went in', /Taken at/i.test(await takenCard.innerText()))
await takenCard.locator('summary').click()
await page.waitForTimeout(250)
const correction = takenCard.getByRole('button', { name: /^Remove the taken entry for Pantocid/ })
check('correction lives behind the disclosure', (await correction.count()) === 1)
await correction.click()
await settle()
check('correcting does not open a dialog', (await page.locator('[role=dialog]').count()) === 0)
await page.reload({ waitUntil: 'networkidle' })
check('correction clears the record', ring(0).test(await text()))
await page.getByRole('button', { name: /^Taken$/ }).first().click()
await page.getByRole('button', { name: /^Taken now$/ }).click()
await settle()

// 4b. Twelve-hour chain — Lacoset's evening dose follows the morning dose.
// The anchor is typed in rather than taken from a relative chip: it must be
// in the past (recordDose rejects futures) AND before noon, so +12h still
// lands on the same care date instead of taking the roll-over branch.
const istHour = Number(
  new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    hour12: false,
  }).format(new Date()),
)
if (istHour < 1) {
  console.log('SKIP  twelve-hour chain — no pre-noon anchor is in the past yet')
} else {
  const anchor = istHour >= 9 ? '08:20' : '00:20'
  const evening = istHour >= 9 ? '8:20 pm' : '12:20 pm'
  const lacoset = page.locator('li', { hasText: 'Lacoset 100' }).first()
  await lacoset.getByRole('button', { name: /^Taken$/ }).click()
  await page.waitForSelector('[role=dialog]')
  await page.fill('[aria-label="Time the dose was taken"]', anchor)
  await page.getByRole('button', { name: /^Save dose time$/ }).click()
  await settle()
  await page.reload({ waitUntil: 'networkidle' })
  const chainText = await text()
  check(
    'lacoset evening derives from the morning dose',
    /12 h after the morning dose · reminder 8:00 pm/i.test(chainText),
  )
  check(
    `lacoset evening moves to ${evening}`,
    chainText.includes(evening),
    chainText.match(/\d+:\d+ [ap]m · Evening/)?.[0],
  )
  // The rail itself moves with the dose, and says what it moved from.
  const anchorPretty = anchor === '08:20' ? '8:20 am' : '12:20 am'
  const anchorDue = 'due 8:00 am' // the printed morning reminder, either way
  const lacosetText = await lacoset.innerText()
  check(
    `morning lacoset sits at ${anchorPretty} on the rail`,
    lacosetText.includes(anchorPretty),
    lacosetText.split('\n').slice(0, 2).join(' · '),
  )
  check('rail keeps the printed time as a subtitle', lacosetText.includes(anchorDue))
  await page.screenshot({ path: `${shots}/12-interval.png`, fullPage: true })
  // Clear the anchor, so the history "Taken 1" assertion later still describes
  // one dose. The only way back is the correction inside the disclosure.
  await lacoset.locator('summary').click()
  await page.waitForTimeout(250)
  await lacoset.getByRole('button', { name: /^Remove the taken entry for Lacoset/ }).click()
  await settle()
  await page.reload({ waitUntil: 'networkidle' })
  check(
    'clearing the anchor restores the printed evening time',
    !/12 h after the morning dose/i.test(await text()),
  )
}

// 4c. The card must not wait on the network. Server Actions are held for well
//     over a second; the dose is a statement about something that already
//     happened, so the timeline has to say so long before the write lands —
//     and the rest of the app has to stay usable while it does.
const HOLD = 1200
let holdWrites = true
await page.route('**/*', async (route) => {
  if (holdWrites && route.request().method() === 'POST') {
    await new Promise((r) => setTimeout(r, HOLD))
  }
  // The route can be torn down while a hold is still sleeping.
  await route.continue().catch(() => {})
})
const slow = page.locator('li', { hasText: 'Tryptomer 10' }).first()
await slow.getByRole('button', { name: /^Taken$/ }).click()
await page.waitForSelector('[role=dialog]')
const optimisticStart = Date.now()
await page.getByRole('button', { name: /^Taken now$/ }).click()
await page.waitForFunction(
  () => /TAKEN AT/i.test(document.querySelector('ul.timeline')?.innerText ?? ''),
  null,
  { timeout: 20000 },
)
const optimisticMs = Date.now() - optimisticStart
check(
  'dose records without waiting for the server',
  optimisticMs < HOLD,
  `${optimisticMs}ms, write held for ${HOLD}ms`,
)
check('sheet closes on the tap, not on the reply', (await page.locator('[role=dialog]').count()) === 0)
check(
  'the rest of the timeline stays live while saving',
  await page.getByRole('button', { name: /^Skip$/ }).first().isEnabled(),
)
holdWrites = false
await settle(1600)
await page.unrouteAll({ behavior: 'ignoreErrors' })
await page.reload({ waitUntil: 'networkidle' })
check('the held write still landed', ring(2).test(await text()), (await text()).match(/\d+\/\d+ taken/)?.[0])
// Put it back, so the later "Taken 1" ledger assertion still describes one dose.
await slow.locator('summary').click()
await page.waitForTimeout(250)
await slow.getByRole('button', { name: /^Remove the taken entry for Tryptomer/ }).click()
await settle()
await page.reload({ waitUntil: 'networkidle' })
check('correction restores the count', ring(1).test(await text()))

// 5. SOS sheet — now reached from the floating button
check('one SOS control on screen', (await page.getByRole('button', { name: /^SOS/ }).count()) === 1)
const sosBox = await page.getByRole('button', { name: /^SOS/ }).boundingBox()
check('SOS floats above the bottom nav', sosBox.y > 600, `y=${Math.round(sosBox.y)}`)
await page.getByRole('button', { name: /^SOS/ }).click()
await page.waitForSelector('text=Outside the routine schedule')
const sosText = await page.locator('[role=dialog]').innerText()
for (const m of ['Napra‑D 500/10', 'Zytee Gel LA', 'Dolo', 'Looz syrup', 'ORS / safe fluids']) {
  check(`sos lists ${m}`, sosText.includes(m))
}
await page.waitForTimeout(600) // let the sheet finish sliding up
await page.screenshot({ path: `${shots}/02-sos.png` })

// 5b. Adding an SOS medicine replaces the SOS sheet rather than stacking on it
await page.getByRole('button', { name: /^Add SOS medicine$/ }).click()
await page.waitForSelector('text=Add SOS medicine')
check('sos add replaces the sos sheet', (await page.locator('[role=dialog]').count()) === 1)
const addText = await page.locator('[role=dialog]').innerText()
check('sos add mode hides the reminder time', !/Reminder time/i.test(addText))
await page.keyboard.press('Escape')
await page.waitForTimeout(400)
check('sos drawer closes on Escape', (await page.locator('[role=dialog]').count()) === 0)

// 5c. An SOS dose lands on Today's timeline without moving the ring
await page.getByRole('button', { name: /^SOS/ }).click()
await page.getByRole('button', { name: /^Log SOS dose of Napra/ }).click()
await settle()
await page.keyboard.press('Escape')
await page.goto(BASE, { waitUntil: 'networkidle' })
const withSos = await text()
check('sos dose shows on the timeline', /Napra‑D 500\/10/.test(withSos))
check(
  'sos dose does not move the ring',
  ring(1).test(withSos),
  withSos.match(/\d+\/\d+ taken/)?.[0],
)
await page.getByRole('button', { name: /^Remove logged dose of Napra/ }).click()
await settle()
// Reload rather than reading straight after: the success toast repeats the
// brand name, so the body text would still match for a couple of seconds.
await page.reload({ waitUntil: 'networkidle' })
check('sos log removable', !/Napra‑D 500\/10/.test(await text()))

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
check(
  'log bp is the floating button',
  (await page.getByRole('button', { name: /^Log BP$/ }).count()) === 1,
)
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
check('editable reminder slots', (await timeInputs.count()) >= 10, `${await timeInputs.count()} inputs`)
await page.screenshot({ path: `${shots}/05-settings.png`, fullPage: true })
// A time no seeded slot already uses — Perinorm's morning reminder is 7:30,
// so filling that would pass whether or not the write actually landed.
await timeInputs.first().fill('06:45')
await settle(800)
await page.goto(BASE, { waitUntil: 'networkidle' })
check('reminder time updated', (await text()).includes('6:45 am'))
await page.screenshot({ path: `${shots}/07-today-after.png`, fullPage: true })

// 11b. The therapy question, and the one rule that protects a recorded dose.
//
// Run last of the Today assertions, because answering it changes the ring's
// denominator and every earlier check is relative to the total read at start.
await page.goto(BASE, { waitUntil: 'networkidle' })
const beforeAnswer = await text()
check(
  'today asks whether there is therapy',
  /Is there radiation therapy today\?/.test(beforeAnswer),
)
check(
  'temozolomide is absent until the day is answered',
  !/Temozolomide/.test(beforeAnswer),
)
check(
  'an unanswered day is never called finished',
  /Answer today’s therapy question/.test(beforeAnswer) || /Due now|Next:/.test(beforeAnswer),
)

await page.getByRole('button', { name: /^Yes, there is radiation therapy today$/ }).click()
await settle(800)
await page.reload({ waitUntil: 'networkidle' })
const afterYes = await text()
const yesTotal = Number(afterYes.match(/\d+\/(\d+) taken/)?.[1])
check('answering yes adds exactly one dose', yesTotal === total + 1, `${total} → ${yesTotal}`)
check('temozolomide joins the timeline', /Temozolomide/.test(afterYes))

// Record the capsule, then take the answer back. The dose must survive: a
// recorded dose is a statement of fact, and the day being re-answered does not
// unswallow it. This is the assertion the whole conditional-schedule feature
// rests on.
const tmz = page.locator('li', { hasText: 'Temozolomide' }).first()
await tmz.getByRole('button', { name: /^Taken$/ }).click()
await page.getByRole('button', { name: /^Taken now$/ }).click()
await settle(800)
await page.getByRole('button', { name: /^Change to no radiation therapy today$/ }).click()
await settle(800)
await page.reload({ waitUntil: 'networkidle' })
const afterNo = await text()
check('a recorded capsule survives the day being re-answered', /Temozolomide/.test(afterNo))
check(
  'and is still counted in both halves of the ring',
  new RegExp(`\\d+/${total + 1} taken`).test(afterNo),
  afterNo.match(/\d+\/\d+ taken/)?.[0],
)
await page.goto(`${BASE}/history`, { waitUntil: 'networkidle' })
check('and still appears in the ledger', /Temozolomide/.test(await text()))

// 11c. Weight — two tiles rather than a decimal key on the pad
await page.goto(`${BASE}/logs`, { waitUntil: 'networkidle' })
await page.getByRole('button', { name: /^Log weight$/ }).first().click()
await page.waitForSelector('[data-weight-key="1"]')
for (const ch of '88') await page.click(`[data-weight-key="${ch}"]`)
await page.click('[data-weight-field="tenths"]')
await page.click('[data-weight-key="6"]')
const weightSheetText = await page.locator('[role=dialog]').innerText()
check('weight sheet previews the reading', /88\.6 kg/.test(weightSheetText))
check(
  'weight sheet previews the change from baseline',
  /−2\.4 kg/.test(weightSheetText),
  weightSheetText.match(/[−+]\d+\.\d+ kg/)?.[0],
)
await page.getByRole('button', { name: /^Save weight$/ }).click()
await settle(800)
await page.reload({ waitUntil: 'networkidle' })
check('weight persisted', /88\.6 kg/.test(await text()))
await page.goto(BASE, { waitUntil: 'networkidle' })
check('weight shows on today', /88\.6 kg/.test(await text()))

// 12. Report
await page.goto(`${BASE}/report`, { waitUntil: 'networkidle' })
const reportText = await text()
check('report renders', reportText.includes('Dose ledger'))
check('report states each day’s therapy answer', /Radiation therapy: (yes|no|not recorded)/.test(reportText))
check('report carries the weight section', /2b · Weight/.test(reportText))

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
