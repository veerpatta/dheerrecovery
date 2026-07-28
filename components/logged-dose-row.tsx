'use client'

import { deleteDoseLog } from '@/lib/actions'
import { useChrome } from './chrome'

/**
 * An unscheduled dose that was actually given — an SOS medicine, or a
 * caregiver-added entry logged as taken. It sits in the day's timeline at the
 * time it happened, so the record reads as a sequence of events rather than a
 * schedule with a separate list of exceptions.
 *
 * The rail node is a diamond rather than a dot: these rows never belonged to
 * the schedule, and the shape says so without needing colour.
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
    <li className="rail-row reveal" data-kind="logged" data-past="true">
      <p className="rail-time">{when}</p>
      <span className="rail-node" aria-hidden>
        <span className={`node ${isSos ? 'node-sos' : 'node-added'}`} />
      </span>

      <div className="card-toned rail-card">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5">
              <span
                className={`tone-dot ${isSos ? 'bg-coral' : 'bg-teal'}`}
                aria-hidden
              />
              <span className="truncate text-[15px] font-extrabold tracking-tight text-navy">
                {brand}
              </span>
            </p>
            <p className="mt-0.5 text-[12px] text-ink/75">
              {dose}{' '}
              <span className="font-medium text-muted">
                · {isSos ? 'logged' : 'caregiver entry'}
              </span>
            </p>
            {note ? <p className="mt-1 text-[11.5px] text-muted">{note}</p> : null}
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <span
              className={`pill ${isSos ? 'bg-coral-soft text-coral-ink' : 'bg-mint text-teal'}`}
            >
              {isSos ? 'SOS' : 'Added'}
            </span>
            <button
              type="button"
              disabled={pending}
              aria-label={`Remove logged dose of ${brand}`}
              onClick={() => run(() => deleteDoseLog(recordId), `${brand} entry removed`)}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-line bg-white text-muted transition active:scale-90 hover:text-coral"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </li>
  )
}
