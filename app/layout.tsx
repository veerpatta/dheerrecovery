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
const inter = localFont({
  src: [
    {
      path: '../node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2',
      style: 'normal',
    },
    {
      path: '../node_modules/@fontsource-variable/inter/files/inter-latin-ext-wght-normal.woff2',
      style: 'normal',
    },
  ],
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
  icons: { icon: '/icon.svg', apple: '/icon.svg' },
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
