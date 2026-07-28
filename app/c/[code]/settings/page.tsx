import { notFound } from 'next/navigation'
import { ReminderRunner } from '@/components/reminders'
import {
  AddMedicineForm,
  SettingsForm,
  SlotTimeRow,
} from '@/components/settings-forms'
import { SyncCard } from '@/components/sync-card'
import { findHousehold, getMedicines } from '@/lib/queries'

export const dynamic = 'force-dynamic'

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ code: string }>
}) {
  const { code } = await params
  const household = await findHousehold(code)
  if (!household) notFound()

  const meds = await getMedicines(household.id)
  const routine = meds.filter((m) => m.kind === 'routine')

  const slots = routine.flatMap((m) =>
    m.slots.map((s) => ({
      id: s.id,
      brand: m.brand,
      label: s.label,
      time: s.time.slice(0, 5),
      // Betacap's 8:00 AM is the only clock time actually printed on the
      // prescription, so it is shown but not treated as a caregiver preference.
      editable: m.catalogId !== 'betacap',
    })),
  )

  return (
    <>
      <section className="card">
        <p className="eyebrow">Caregiver setup</p>
        <h1 className="mt-1 text-xl font-bold tracking-tight text-navy">
          Sync, times &amp; alerts
        </h1>
      </section>

      <SyncCard code={code} />

      <section className="card space-y-3">
        <div>
          <p className="eyebrow">Alert speed</p>
          <h2 className="mt-1 text-base font-bold text-navy">
            Notification before every routine dose
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-muted">
            SOS medicine is intentionally excluded. Routine reminders appear while
            this site is open, after notification permission is enabled.
          </p>
        </div>

        <SettingsForm
          code={code}
          alertLeadMinutes={household.alertLeadMinutes}
          courseStart={household.courseStart}
        />

        <ReminderRunner
          slots={slots.map(({ id, brand, label, time }) => ({
            id,
            brand,
            label,
            time,
          }))}
          leadMinutes={household.alertLeadMinutes}
        />
      </section>

      <section className="card space-y-3">
        <div>
          <p className="eyebrow">Routine reminder times</p>
          <h2 className="mt-1 text-base font-bold text-navy">Edit times</h2>
          <p className="mt-1 text-xs leading-relaxed text-muted">
            Change only the clock reminder — not the printed frequency or dose.
            Betacap is printed for 8:00 AM; other exact clock times are caregiver
            reminders for “morning,” “evening” or “night.”
          </p>
        </div>
        <ul className="space-y-2">
          {slots.map((s) => (
            <SlotTimeRow key={s.id} code={code} slotId={s.id} {...s} />
          ))}
        </ul>
      </section>

      <AddMedicineForm code={code} />
    </>
  )
}
