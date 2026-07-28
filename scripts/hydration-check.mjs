/**
 * Reproduce hydration warnings against a dev server, where React prints the
 * full (non-minified) message including the offending markup.
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

await page.goto(BASE, { waitUntil: 'networkidle' })
await page.getByRole('button', { name: /Create care record/i }).click()
await page.waitForURL(/\/c\/[A-Z0-9]+$/, { timeout: 20000 })
const careUrl = page.url()

await page.goto(`${careUrl}/logs`, { waitUntil: 'networkidle' })
for (const [s, d, p] of [
  [126, 82, 74],
  [148, 94, 88],
]) {
  await page.fill('input[name=systolic]', String(s))
  await page.fill('input[name=diastolic]', String(d))
  await page.fill('input[name=pulse]', String(p))
  await page.getByRole('button', { name: /Save BP/i }).click()
  await page.waitForTimeout(2500)
}

for (const p of ['/logs', '/logs?days=14', '/history', '/report', '/settings', '/chart', '/safety', '']) {
  await page.goto(`${careUrl}${p}`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1200)
}

console.log(seen.length ? seen.join('\n\n---\n\n') : 'no console errors or warnings')
await browser.close()
