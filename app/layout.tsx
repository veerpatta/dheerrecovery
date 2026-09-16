import type { Metadata, Viewport } from 'next'
import localFont from 'next/font/local'
import './globals.css'

export const dynamic = 'force-dynamic'

/*
 * Fonts are vendored through @fontsource rather than `next/font/google`.
 * Two reasons: the app is a `noindex` medical record and should not fetch
 * anything from a third party at runtime, and `next/font/google` needs
 * outbound access to fonts.googleapis.com at *build* time, which fails on
 * any runner without egress.
 *
 * Inter carries no Devanagari, so the Hindi chrome gets its own face — the
 * app renders Hindi on every screen.
 */
/*
 * One `src`, deliberately. This used to list latin and latin-ext as two
 * entries, which looks like a charset split but is not one: `next/font/local`
 * emits them as two @font-face rules with the same family, weight and style
 * and no `unicode-range`, so the last simply wins and the other is dead
 * weight. The winner was latin-ext, at 85 KB against latin's 48 KB — the app
 * was paying 37 KB extra on the font that gates first paint of every label,
 * for glyphs it never renders. A sweep of the source found no character in
 * U+0100-024F; the Hindi text has its own face below, and the few symbols
 * (✓ ⚑ ⚙ →) are outside both subsets and fall back either way.
 */
const inter = localFont({
  src: '../node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2',
  weight: '100 900',
  variable: '--font-inter',
  display: 'swap',
  fallback: ['ui-sans-serif', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI'],
})

const devanagari = localFont({
  src: '../node_modules/@fontsource-variable/noto-sans-devanagari/files/noto-sans-devanagari-devanagari-wght-normal.woff2',
  weight: '100 900',
  variable: '--font-devanagari',
  display: 'swap',
  fallback: ['ui-sans-serif', 'sans-serif'],
})

export const metadata: Metadata = {
  title: 'Dheer Recovery Medicines',
  description:
    'Caregiver organiser for the 28 July 2026 prescription — doses, blood pressure, seizure watch and doctor-ready exports.',
  manifest: '/manifest.webmanifest',
  /*
   * The PNGs are not belt-and-braces. iOS ignores SVG icons completely, so
   * without a real apple-touch-icon the Home-Screen app gets a grey
   * screenshot of the page instead of the logo — and on iOS the Home Screen
   * is the only place web push is allowed to work at all.
   */
  icons: {
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml' },
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
  robots: { index: false, follow: false },
  appleWebApp: { capable: true, title: 'Dheer Recovery', statusBarStyle: 'default' },
}

export const viewport: Viewport = {
  themeColor: '#dfe5e2',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${devanagari.variable}`}>
      <body>{children}</body>
    </html>
  )
}
