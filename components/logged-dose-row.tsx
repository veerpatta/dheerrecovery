'use client'

import { deleteDoseLog } from '@/lib/actions'
import { useChrome } from './chrome'

/**
 * An unscheduled dose that was actually given — an SOS medicine, or a
 * caregiver-added entry logged as taken. It sits in the day's timeline at the
 * time it happened, so the record reads as a sequence of events rather than a
 * schedule with a separate list of exceptions.
 */
export function LoggedDoseRow({
  recordId,
  brand,
  dose,
  when,
  note,
  isSos,
}: {
  recordId: string
  brand: string
  dose: string
  /** Already formatted in the care timezone. */
  when: string
  note: string | null
  isSos: boolean
}) {
  const { run, pending } = useChrome()

  return (
    <li className="card-toned">
      <span className={`spine ${isSos ? 'bg-coral' : 'bg-teal'}`} aria-hidden />
      <div className="flex items-start justify-between gap-2.5 py-3 pr-3.5 pl-[18px]">
        <div className="min-w-0">
          <p className="text-[15px] font-extrabold text-navy">
            {when}{' '}
            <span className="text-[11px] font-medium text-muted">
              · {isSos ? 'logged' : 'caregiver entry'}
            </span>
          </p>
          <p className="mt-0.5 text-[15px] font-extrabold tracking-tight text-navy">
            {brand}
          </p>
          <p className="text-[12.5px] text-ink/80">{dose}</p>
          {note ? <p className="mt-1 text-[11.5px] text-muted">{note}</p> : null}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <span
            className={`pill ${isSos ? 'bg-coral-soft text-coral' : 'bg-mint text-teal'}`}
          >
            {isSos ? 'SOS' : 'Added'}
          </span>
          <button
            type="button"
            disabled={pending}
            aria-label={`Remove logged dose of ${brand}`}
            onClick={() => run(() => deleteDoseLog(recordId), `${brand} entry removed`)}
            className="text-[11px] font-bold text-muted hover:text-coral"
          >
            Remove
          </button>
        </div>
      </div>
    </li>
  )
}
