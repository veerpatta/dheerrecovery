import Link from 'next/link'
import { ChromeProvider, SyncLabel } from '@/components/chrome'
import { LangToggle } from '@/components/lang-toggle'
import { NavTabs } from '@/components/nav-tabs'
import { Fab } from '@/components/fab'
import { SheetHost } from '@/components/sheet-host'
import { getHousehold } from '@/lib/household'
import { getBpReadings, getMedicines, getSosRecords } from '@/lib/queries'
import { bandOf } from '@/lib/bp'
import { weightBandOf } from '@/lib/weight'

export const dynamic = 'force-dynamic'

/**
 * The phone shell. The design draws a 430px device with its own inner scroll
 * region; this uses the document scroller instead — visually identical at the
 * width the design targets, but hash anchors, scroll restoration and printing
 * all keep working.
 */
export default async function ShellLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const household = await getHousehold()
  const [meds, sosRecords, readings] = await Promise.all([
    getMedicines(household.id),
    getSosRecords(household.id, 40),
    getBpReadings(household.id, 1),
  ])
  const sos = meds.filter((m) => m.kind === 'sos')

  return (
    <ChromeProvider>
      <div className="shell mx-auto min-h-dvh w-full max-w-[var(--shell-width)] bg-paper shadow-shell">
        {/*
          Opaque, not translucent. A sticky `backdrop-blur` header re-runs a
          full-width backdrop-filter every scroll frame, and a fixed nav did
          the same at the bottom — two blur passes per frame on the screen the
          app spends its life scrolling. At this palette the difference is
          barely visible; on the scroll it was the whole difference.
        */}
        <header className="sticky top-0 z-20 flex items-center gap-2.5 border-b border-line bg-paper px-3.5 py-2.5 no-print">
          <svg
            width="30"
            height="30"
            viewBox="0 0 512 512"
            className="shrink-0 rounded-lg"
            aria-hidden
          >
            <rect width="512" height="512" rx="112" fill="#132238" />
            <path
              d="M256 128c-52 0-94 42-94 94v68c0 52 42 94 94 94s94-42 94-94v-68c0-52-42-94-94-94Z"
              fill="#29a997"
            />
            <path d="M162 256h188" stroke="#f6f8f6" strokeWidth="26" strokeLinecap="round" />
          </svg>

          <Link href="/" className="min-w-0 flex-1">
            <p className="text-[9.5px] font-semibold tracking-[0.14em] text-muted uppercase">
              <span className="lang-en">Caregiver organiser</span>
              <span className="lang-hi">देखभाल आयोजक</span>
            </p>
            <p className="truncate text-[15px] font-extrabold tracking-tight text-navy">
              {household.patientName} Recovery <SyncLabel />
            </p>
          </Link>

          <LangToggle />

          {/* SOS moved to the floating stack — one place per action. */}
          <Link
            href="/settings"
            aria-label="Settings"
            className="shrink-0 rounded-full border border-line bg-white px-2.5 py-1.5 text-xs text-ink transition active:scale-95"
          >
            ⚙
          </Link>
        </header>

        {/* Bottom padding clears both the nav and the floating stack. */}
        <main className="flex flex-col gap-3 px-3.5 pt-3.5 pb-[calc(11rem+env(safe-area-inset-bottom))]">
          {children}
        </main>

        <Fab sosCount={sos.length} />
        <NavTabs />
      </div>

      <SheetHost
        sos={sos}
        sosRecords={sosRecords}
        band={bandOf(household)}
        lastReadingAt={readings[0]?.measuredAt ?? null}
        weightBand={weightBandOf(household)}
        weightBaselineGrams={household.weightBaselineGrams}
      />
    </ChromeProvider>
  )
}
