import { redirect } from 'next/navigation'
import { PRESCRIBER, PRESCRIPTION_DATE } from '@/lib/catalog'
import { isValidCareCode } from '@/lib/care-code'
import { findHousehold } from '@/lib/queries'
import { prettyRxDate } from '@/lib/time'
import { EntryForms } from '@/components/entry-forms'

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ care?: string }>
}) {
  const { care } = await searchParams
  if (care && isValidCareCode(care) && (await findHousehold(care))) {
    redirect(`/c/${encodeURIComponent(care)}`)
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col justify-center gap-6 px-5 py-12">
      <header className="space-y-2">
        <p className="eyebrow">Caregiver organiser</p>
        <h1 className="text-3xl font-bold tracking-tight text-navy">
          Dheer Recovery Medicines
        </h1>
        <p className="text-sm leading-relaxed text-muted">
          Doses, blood pressure, seizure watch and doctor-ready exports for the{' '}
          {prettyRxDate(PRESCRIPTION_DATE)} prescription from {PRESCRIBER}.
        </p>
      </header>

      <EntryForms />

      <div className="card space-y-2 bg-coral-soft/60">
        <p className="eyebrow text-coral">How access works</p>
        <p className="text-sm leading-relaxed text-ink">
          There is no login. One private care link opens the same record on every
          phone, so treat the link like a password and share it only with trusted
          caregivers. Anyone holding it can view and edit the family record.
        </p>
      </div>

      <p className="text-center text-xs leading-relaxed text-muted">
        This organiser supports — it does not replace — the prescription and the
        treating team. Never skip, double, stop or change a medicine based on this
        app.
      </p>
    </main>
  )
}
