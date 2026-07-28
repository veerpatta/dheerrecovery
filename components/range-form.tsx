'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { addDays, careDate } from '@/lib/time'

const PRESETS = [7, 14, 30]

export function RangeForm({ from, to }: { from: string; to: string }) {
  const router = useRouter()
  const [start, setStart] = useState(from)
  const [end, setEnd] = useState(to)

  function go(nextFrom: string, nextTo: string) {
    setStart(nextFrom)
    setEnd(nextTo)
    router.push(`/history?from=${nextFrom}&to=${nextTo}`)
  }

  return (
    <section className="card no-print">
      <p className="eyebrow">View range</p>
      <h2 className="mt-1 text-base font-bold text-navy">Daily medicine history</h2>

      <div className="mt-3 flex flex-wrap gap-2">
        {PRESETS.map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => {
              const today = careDate()
              go(addDays(today, -(d - 1)), today)
            }}
            className="pill border border-line bg-white text-ink hover:bg-paper"
          >
            {d} days
          </button>
        ))}
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
        <label className="block space-y-1">
          <span className="eyebrow">From</span>
          <input
            type="date"
            value={start}
            max={end}
            onChange={(e) => setStart(e.target.value)}
            className="field"
          />
        </label>
        <label className="block space-y-1">
          <span className="eyebrow">To</span>
          <input
            type="date"
            value={end}
            min={start}
            max={careDate()}
            onChange={(e) => setEnd(e.target.value)}
            className="field"
          />
        </label>
        <button
          type="button"
          onClick={() => go(start, end)}
          className="btn-primary self-end"
        >
          Apply
        </button>
      </div>
    </section>
  )
}
