import Link from 'next/link'
import { ReminderRunner } from '@/components/reminders'
import {
  AddMedicineForm,
  AlertLeadChips,
  CourseStartForm,
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
      medicineId: m.id,
      brand: m.brand,
      label: s.label,
      time: s.time.slice(0, 5),
      // Betacap's 8:00 AM is the only clock time actually printed on the
      // prescription, so it is shown but not treated as a caregiver preference.
      editable: m.catalogId !== 'betacap',
      removable: m.isCustom,
    })),
  )

  return (
    <>
      <section className="card flex items-center justify-between gap-2.5">
        <div>
          <p className="eyebrow">Caregiver setup</p>
          <h1 className="mt-1 text-xl font-extrabold tracking-tight text-navy">
            <span className="lang-en">Times &amp; alerts</span>
            <span className="lang-hi">समय और अलर्ट</span>
          </h1>
        </div>
        <Link
          href="/"
          className="shrink-0 rounded-full border border-line bg-white px-3.5 py-2 text-xs font-bold text-ink transition active:scale-95"
        >
          <span className="lang-en">Done</span>
          <span className="lang-hi">पूर्ण</span>
        </Link>
      </section>

      <section className="card flex flex-col gap-2.5">
        <div>
          <p className="eyebrow">Alert speed</p>
          <h2 className="mt-1 text-[15px] font-extrabold text-navy">
            Notification before every routine dose
          </h2>
          <p className="mt-1 text-[11.5px] leading-relaxed text-muted">
            SOS medicine is intentionally excluded. Routine reminders appear while
            this site is open, after notification permission is enabled.
          </p>
        </div>

        <AlertLeadChips alertLeadMinutes={household.alertLeadMinutes} />

        <ReminderRunner
          slots={slots.map(({ id, brand, label, time }) => ({ id, brand, label, time }))}
          leadMinutes={household.alertLeadMinutes}
        />

        <CourseStartForm courseStart={household.courseStart} />
      </section>

      {/*
        The reminder rows come before the add form so the first `input[type=time]`
        on the page is always a real reminder slot.
      */}
      <section className="card flex flex-col gap-2">
        <div>
          <p className="eyebrow">Routine reminder times</p>
          <h2 className="mt-1 text-[15px] font-extrabold text-navy">Edit times</h2>
          <p className="mt-1 text-[11.5px] leading-relaxed text-muted">
            Change only the clock reminder — not the printed frequency or dose.
            Betacap is printed for 8:00 AM; other exact clock times are caregiver
            reminders for “morning,” “evening” or “night.”
          </p>
        </div>
        <ul className="flex flex-col gap-2">
          {slots.map((s) => (
            <SlotTimeRow key={s.id} slotId={s.id} {...s} />
          ))}
        </ul>
      </section>

      <AddMedicineForm />
    </>
  )
}
