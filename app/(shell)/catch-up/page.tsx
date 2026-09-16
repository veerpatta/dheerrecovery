import Link from 'next/link'
import { DoseCard } from '@/components/dose-card'
import { getHousehold } from '@/lib/household'
import {
  buildDaySchedule,
  getDoseRecords,
  getMedicines,
  getTherapyDays,
} from '@/lib/queries'
import {
  careClock,
  careDate,
  careMinutes,
  driftMinutes,
  minutesOf,
  prettyDate,
} from '@/lib/time'

export const dynamic = 'force-dynamic'

/**
 * The doses that were never written down, and nothing else.
 *
 * This is where the evening notification lands. It exists as a real route
 * rather than a mode on Today for two reasons: Today is already the longest
 * page in the app, and a notification needs a URL its service worker can focus
 * an existing tab on.
 *
 * `?date=` matters more than it looks — a wrap opened at half past midnight is
 * acting on yesterday, and `careInstant(doseDate, time)` already handles a
 * past date correctly.
 *
 * There is deliberately no "mark all as taken". A page that made it one tap to
 * assert eleven doses were swallowed would be the exact thing the rest of this
 * app refuses to do: a missing entry does not prove a missed dose, and it does
 * not prove a taken one either.
 */
export default async function CatchUpPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; focus?: string }>
}) {
  const sp = await searchParams
  const household = await getHousehold()

  const today = careDate()
  const isDate = (v?: string) => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v)
  // Never accept a future date: there is nothing to catch up on.
  const date = isDate(sp.date) && sp.date! <= today ? sp.date! : today

  const [meds, records, therapyDays] = await Promise.all([
    getMedicines(household.id),
    getDoseRecords(household.id, date, date),
    getTherapyDays(household.id, date, date),
  ])

  const schedule = buildDaySchedule(meds, records, date, { therapyDays })
  const open = schedule.filter((d) => d.status === 'not-recorded')
  const nowMinutes = careMinutes()
  const focus = sp.focus ?? null

  return (
    <>
      <section className="card">
        <p className="eyebrow">
          <span className="lang-en">Catch up</span>
          <span className="lang-hi">बाकी दर्ज करें</span>
        </p>
        <h1 className="mt-1 text-xl font-extrabold tracking-tight text-navy">
          {open.length === 0 ? (
            <>
              <span className="lang-en">Nothing left to write down</span>
              <span className="lang-hi">कुछ भी दर्ज करना बाकी नहीं</span>
            </>
          ) : (
            <>
              <span className="lang-en">
                {open.length} {open.length === 1 ? 'dose' : 'doses'} to write down
              </span>
              <span className="lang-hi">{open.length} खुराक दर्ज करनी हैं</span>
            </>
          )}
        </h1>
        <p className="mt-1 text-xs text-muted">{prettyDate(date)}</p>
        <p className="mt-1.5 text-[12px] leading-relaxed text-muted">
          <span className="lang-en">
            A missing entry does not prove a missed dose. Record each one with the
            time it was actually given — and if it was not given, record that
            instead.
          </span>
          <span className="lang-hi">
            दर्ज न होना यह साबित नहीं करता कि खुराक छूटी। हर एक को उसी समय के साथ
            दर्ज करें जब वह दी गई — और अगर नहीं दी गई, तो वही दर्ज करें।
          </span>
        </p>
      </section>

      {open.length === 0 ? (
        <Link href="/" className="btn-primary flex h-12 items-center justify-center">
          <span className="lang-en">Back to today</span>
          <span className="lang-hi">आज पर वापस</span>
        </Link>
      ) : (
        <ul className="timeline">
          {open.map((dose) => (
            <DoseCard
              key={`${dose.medicine.id}-${dose.slotKey}`}
              doseDate={date}
              medicineId={dose.medicine.id}
              slotKey={dose.slotKey}
              brand={dose.medicine.brand}
              generic={dose.medicine.generic}
              dose={dose.medicine.dose}
              label={dose.label}
              time={dose.time}
              plannedTime={dose.plannedTime}
              intervalHours={dose.intervalHours}
              rollsOver={dose.rollsOver}
              derivedFrom={
                dose.derivedFrom
                  ? {
                      label: dose.derivedFrom.label,
                      takenAt: dose.derivedFrom.takenAt.toISOString(),
                    }
                  : null
              }
              tone={dose.medicine.tone}
              status={dose.status}
              purpose={dose.medicine.purpose}
              prescriptionHi={dose.medicine.prescriptionHi}
              food={dose.medicine.food}
              instruction={dose.medicine.instruction}
              caution={dose.medicine.caution}
              verify={dose.medicine.verify}
              isNext={focus === `${dose.medicine.id}::${dose.slotKey}`}
              overdueMinutes={
                date === careDate()
                  ? Math.max(0, nowMinutes - minutesOf(dose.time))
                  : null
              }
              clearedStatus="not-recorded"
              takenClock={
                dose.record?.takenAt ? careClock(new Date(dose.record.takenAt)) : null
              }
              drift={
                dose.record?.takenAt && dose.record.scheduledTime
                  ? driftMinutes(
                      date,
                      dose.record.scheduledTime,
                      new Date(dose.record.takenAt),
                    )
                  : null
              }
            />
          ))}
        </ul>
      )}

      <Link
        href="/"
        className="flex items-center justify-center rounded-2xl border-[1.5px] border-line py-3 text-sm font-bold text-muted transition active:scale-[0.98]"
      >
        <span className="lang-en">Today’s full timeline</span>
        <span className="lang-hi">आज की पूरी सूची</span>
      </Link>
    </>
  )
}
