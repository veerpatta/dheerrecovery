import type { Metadata, Viewport } from 'next'
import Link from 'next/link'
import { LangToggle } from '@/components/lang-toggle'
import { NavTabs } from '@/components/nav-tabs'
import { QuickBar } from '@/components/quick-bar'
import { SosDrawer } from '@/components/sos-drawer'
import { VerifyBanner } from '@/components/verify-banner'
import { getHousehold } from '@/lib/household'
import { getMedicines } from '@/lib/queries'
import { prettyRxDate } from '@/lib/time'
import './globals.css'

export const dynamic = 'force-dynamic'

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

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const household = await getHousehold()
  const meds = await getMedicines(household.id)
  const sos = meds.filter((m) => m.kind === 'sos')

  return (
    <html lang="en">
      <body>
        <div className="mx-auto min-h-dvh w-full max-w-3xl pb-28">
          <header className="sticky top-0 z-30 border-b border-line bg-paper/90 px-4 py-3 backdrop-blur no-print">
            <div className="flex items-center justify-between gap-3">
              <Link href="/" className="min-w-0">
                <p className="eyebrow">Caregiver organiser</p>
                <p className="truncate text-base font-bold tracking-tight text-navy">
                  {household.patientName} Recovery
                </p>
              </Link>
              <div className="flex shrink-0 items-center gap-2">
                <LangToggle />
                <SosDrawer medicines={sos} />
                <Link
                  href="/settings"
                  aria-label="Settings"
                  className="rounded-full border border-line bg-white px-3 py-1.5 text-xs font-semibold text-ink"
                >
                  ⚙
                </Link>
              </div>
            </div>
            <NavTabs />
          </header>

          <main className="space-y-4 px-4 py-4">
            {!household.rxVerifiedAt ? (
              <VerifyBanner
                prescriptionDate={prettyRxDate(household.prescriptionDate)}
              />
            ) : null}
            {children}
          </main>

          <QuickBar />
        </div>
      </body>
    </html>
  )
}
