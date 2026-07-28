import { notFound } from 'next/navigation'
import Link from 'next/link'
import { isValidCareCode } from '@/lib/care-code'
import { findHousehold, getMedicines } from '@/lib/queries'
import { prettyRxDate } from '@/lib/time'
import { LangToggle } from '@/components/lang-toggle'
import { NavTabs } from '@/components/nav-tabs'
import { SosDrawer } from '@/components/sos-drawer'
import { VerifyBanner } from '@/components/verify-banner'
import { QuickBar } from '@/components/quick-bar'

export const dynamic = 'force-dynamic'

export default async function CareLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ code: string }>
}) {
  const { code } = await params
  if (!isValidCareCode(code)) notFound()

  const household = await findHousehold(code)
  if (!household) notFound()

  const meds = await getMedicines(household.id)
  const sos = meds.filter((m) => m.kind === 'sos')

  return (
    <div className="mx-auto min-h-dvh w-full max-w-3xl pb-28">
      <header className="sticky top-0 z-30 border-b border-line bg-paper/90 px-4 py-3 backdrop-blur no-print">
        <div className="flex items-center justify-between gap-3">
          <Link href={`/c/${code}`} className="min-w-0">
            <p className="eyebrow">Caregiver organiser</p>
            <p className="truncate text-base font-bold tracking-tight text-navy">
              {household.patientName} Recovery
            </p>
          </Link>
          <div className="flex shrink-0 items-center gap-2">
            <LangToggle />
            <SosDrawer code={code} medicines={sos} />
            <Link
              href={`/c/${code}/settings`}
              className="rounded-full border border-line bg-white px-3 py-1.5 text-xs font-semibold text-ink"
            >
              ⚙
            </Link>
          </div>
        </div>
        <NavTabs code={code} />
      </header>

      <main className="space-y-4 px-4 py-4">
        {!household.rxVerifiedAt ? (
          <VerifyBanner
            code={code}
            prescriptionDate={prettyRxDate(household.prescriptionDate)}
          />
        ) : null}
        {children}
      </main>

      <QuickBar code={code} />
    </div>
  )
}
