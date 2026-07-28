'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { addDays, careDate, daysBetween } from '@/lib/time'

const PRESETS = [7, 14, 30]

/**
 * Chips set `from`/`to` rather than a `days` count, so the range stays
 * coherent with `/report?from&to` and the Excel export, which take dates.
 */
export function RangeForm({ from, to }: { from: string; to: string }) {
  const router = useRouter()
  const [start, setStart] = useState(from)
  const [end, setEnd] = useState(to)

  const today = careDate()
  const span = daysBetween(from, to) + 1
  const activePreset = to === today ? span : null

  function go(nextFrom: string, nextTo: string) {
    setStart(nextFrom)
    setEnd(nextTo)
    router.push(`/history?from=${nextFrom}&to=${nextTo}`)
  }

  return (
    <div className="flex flex-col gap-2 no-print">
      <div className="flex gap-2">
        {PRESETS.map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => go(addDays(today, -(d - 1)), today)}
            className={activePreset === d ? 'chip-on' : 'chip'}
          >
            {d} days
          </button>
        ))}
      </div>

      <details>
        <summary className="flex items-center gap-1 py-1 text-xs font-bold text-teal">
          Pick exact dates
          <svg
            className="chev"
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            aria-hidden
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </summary>
        <div className="grid grid-cols-2 gap-2 pt-2">
          <label className="block space-y-1">
            <span className="eyebrow text-[10px]">From</span>
            <input
              type="date"
              value={start}
              max={end}
              onChange={(e) => setStart(e.target.value)}
              className="field"
            />
          </label>
          <label className="block space-y-1">
            <span className="eyebrow text-[10px]">To</span>
            <input
              type="date"
              value={end}
              min={start}
              max={today}
              onChange={(e) => setEnd(e.target.value)}
              className="field"
            />
          </label>
          <button
            type="button"
            onClick={() => go(start, end)}
            className="btn-primary col-span-2"
          >
            Apply
          </button>
        </div>
      </details>
    </div>
  )
}
