/**
 * Render the app icon to the PNGs a Home-Screen install needs.
 *
 * iOS ignores SVG icons entirely — it wants a real `apple-touch-icon.png`, and
 * without one the Home-Screen app gets a grey screenshot of the page instead
 * of the logo. Chrome's install criteria want 192 and 512 PNGs too. The
 * manifest keeps the SVG as an extra entry because it is sharper wherever it
 * is honoured.
 *
 * Playwright is already a dev dependency, so this needs no image library: it
 * renders the SVG in a real browser at each size and screenshots it.
 *
 * Uses whatever Chromium is already on the machine — Playwright's own browser
 * download is ~150 MB for four screenshots. `channel: 'msedge'` covers any
 * Windows box; CHROME_PATH overrides, matching scripts/smoke.mjs.
 *
 * Usage: node scripts/make-icons.mjs
 */
import { chromium } from 'playwright'
import { mkdirSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const svg = readFileSync(resolve(root, 'public/icon.svg'), 'utf8')
mkdirSync(resolve(root, 'public/icons'), { recursive: true })

/**
 * `inset` shrinks the artwork inside the canvas. A maskable icon may be
 * cropped to a circle by the launcher, so its content has to sit inside the
 * middle 80% — the background still bleeds to every edge.
 */
const TARGETS = [
  { file: 'public/apple-touch-icon.png', size: 180, inset: 0, opaque: true },
  { file: 'public/icons/icon-192.png', size: 192, inset: 0 },
  { file: 'public/icons/icon-512.png', size: 512, inset: 0 },
  { file: 'public/icons/icon-512-maskable.png', size: 512, inset: 0.14 },
]

const browser = await chromium.launch(
  process.env.CHROME_PATH
    ? { executablePath: process.env.CHROME_PATH }
    : { channel: 'msedge' },
)
const page = await browser.newPage()

for (const t of TARGETS) {
  const pad = Math.round(t.size * t.inset)
  await page.setViewportSize({ width: t.size, height: t.size })
  await page.setContent(
    `<style>
       html,body{margin:0;padding:0;background:#132238}
       .wrap{width:${t.size}px;height:${t.size}px;display:grid;place-items:center;background:#132238}
       svg{width:${t.size - pad * 2}px;height:${t.size - pad * 2}px;display:block}
     </style>
     <div class="wrap">${svg}</div>`,
  )
  await page.locator('.wrap').screenshot({
    path: resolve(root, t.file),
    // Apple refuses transparency and draws its own rounded mask, so the
    // touch icon is flattened onto the brand navy rather than left alpha.
    omitBackground: false,
  })
  console.log(`${t.file}  ${t.size}x${t.size}${pad ? ` (inset ${pad}px)` : ''}`)
}

/*
 * The Android status-bar badge is a different thing entirely: it is masked to
 * a silhouette, so it must be a white shape on transparency. Colour in it is
 * thrown away. iOS ignores `badge` altogether.
 */
await page.setViewportSize({ width: 72, height: 72 })
await page.setContent(
  `<style>html,body{margin:0;background:transparent}</style>
   <svg xmlns="http://www.w3.org/2000/svg" width="72" height="72" viewBox="0 0 512 512">
     <path d="M256 96c-60 0-108 48-108 108v104c0 60 48 108 108 108s108-48 108-108V204c0-60-48-108-108-108Z" fill="#fff"/>
     <path d="M150 256h212" stroke="#132238" stroke-width="30" stroke-linecap="round"/>
   </svg>`,
)
await page.locator('svg').screenshot({
  path: resolve(root, 'public/icons/badge-72.png'),
  omitBackground: true,
})
console.log('public/icons/badge-72.png  72x72 (transparent)')

await browser.close()
