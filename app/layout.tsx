import type { Metadata, Viewport } from 'next'
import './globals.css'

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
  themeColor: '#f6f8f6',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
