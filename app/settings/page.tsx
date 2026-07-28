import { ReminderRunner } from '@/components/reminders'
import {
  AddMedicineForm,
  SettingsForm,
  SlotTimeRow,
} from '@/components/settings-forms'
import { getHousehold } from '@/lib/household'
import { getMedicines } from '@/lib/queries'

export const dynamic = 'force-dynamic'

export default async function SettingsPage() {
  const household = await getHousehold()

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
          Times &amp; alerts
        </h1>
        <p className="mt-1.5 text-sm leading-relaxed text-muted">
          The app opens straight onto this record on every phone — nothing to
          set up, no code to share.
        </p>
      </section>

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
            <SlotTimeRow key={s.id} slotId={s.id} {...s} />
          ))}
        </ul>
      </section>

      <AddMedicineForm />
    </>
  )
}
