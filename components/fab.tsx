'use client'

import { useChrome } from './chrome'

/**
 * Floating quick actions, above the bottom nav on every screen.
 *
 * Logging a BP reading and reaching for an SOS medicine are the two things a
 * caregiver does mid-task, often one-handed, and neither should cost a
 * navigation. The stack is pinned to the same 430px column as the nav so it
 * lines up rather than drifting to the window edge on a desktop.
 */
export function Fab({ sosCount }: { sosCount: number }) {
  const { openSheet } = useChrome()

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-30 mx-auto flex w-full max-w-[var(--shell-width)] flex-col items-end gap-2 px-3.5 no-print">
      <button
        type="button"
        onClick={() => openSheet('sos')}
        aria-label={`SOS medicines, ${sosCount} available`}
        className="pointer-events-auto flex items-center gap-2 rounded-full bg-coral py-3 pr-4 pl-3.5 text-[13px] font-extrabold text-white shadow-[0_8px_20px_rgba(238,105,86,.35)] transition active:scale-95"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z" />
          <path d="M12 8.5v4M12 15.5h.01" />
        </svg>
        SOS
        <span className="rounded-full bg-white/25 px-1.5">{sosCount}</span>
      </button>

      <button
        type="button"
        onClick={() => openSheet('bp')}
        aria-label="Log BP"
        className="pointer-events-auto flex items-center gap-2 rounded-full bg-teal py-3 pr-4 pl-3.5 text-[13px] font-extrabold text-white shadow-[0_8px_20px_rgba(41,169,151,.35)] transition active:scale-95"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M3 12h4l2-6 4 12 2-6h6" />
        </svg>
        <span className="lang-en" aria-hidden>
          Log BP
        </span>
        <span className="lang-hi" aria-hidden>
          BP दर्ज करें
        </span>
      </button>
    </div>
  )
}
