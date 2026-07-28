/**
 * Reproduce hydration warnings against a dev server, where React prints the
 * full (non-minified) message including the offending markup.
 *
 * Usage: BASE_URL=http://127.0.0.1:3112 node scripts/hydration-check.mjs
 */
import { chromium } from 'playwright'

const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:3112'
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || undefined,
})
const page = await browser
  .newContext({ viewport: { width: 420, height: 900 } })
  .then((c) => c.newPage())

const seen = []
page.on('pageerror', (e) => seen.push(`PAGEERROR @ ${page.url()}\n${e.stack ?? e}`))
page.on('console', (m) => {
  if (m.type() === 'error' || m.type() === 'warning') {
    seen.push(`${m.type().toUpperCase()} @ ${page.url()}\n${m.text()}`)
  }
})

// The app opens straight onto the record — there is nothing to create first.
await page.goto(BASE, { waitUntil: 'networkidle' })

// The BP keypad is the densest client component, so exercise it explicitly.
await page.goto(`${BASE}/logs`, { waitUntil: 'networkidle' })
for (const [s, d, p] of [
  [126, 82, 74],
  [148, 94, 88],
]) {
  await page.getByRole('button', { name: /^Log BP$/ }).first().click()
  await page.waitForSelector('[data-bp-key="1"]')
  for (const ch of String(s)) await page.click(`[data-bp-key="${ch}"]`)
  await page.click('[data-bp-field="diastolic"]')
  for (const ch of String(d)) await page.click(`[data-bp-key="${ch}"]`)
  await page.click('[data-bp-field="pulse"]')
  for (const ch of String(p)) await page.click(`[data-bp-key="${ch}"]`)
  await page.getByRole('button', { name: /^Save BP$/ }).click()
  await page.waitForTimeout(2500)
}

// Both languages, because the bilingual chrome is a common source of drift.
for (const lang of ['en', 'hi']) {
  await page.addInitScript(
    (value) => localStorage.setItem('dheer-lang', value),
    lang,
  )
  for (const p of [
    '/',
    '/logs',
    '/logs?days=14',
    '/history',
    '/report',
    '/settings',
    '/chart',
    '/safety',
  ]) {
    await page.goto(`${BASE}${p}`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(1000)
  }
}

console.log(seen.length ? seen.join('\n\n---\n\n') : 'no console errors or warnings')
await browser.close()
process.exit(seen.length ? 1 : 0)
