import type { BpReading } from '@/db/schema'
import type { Band } from '@/lib/bp'
import { shortDay } from '@/lib/time'

/**
 * Plain inline SVG: no chart library, no client JS, prints correctly in the
 * doctor report. Readings are expected newest-first.
 */
export function BpChart({
  readings,
  band,
  height = 180,
}: {
  readings: BpReading[]
  band: Band
  height?: number
}) {
  const points = [...readings]
    .sort((a, b) => +new Date(a.measuredAt) - +new Date(b.measuredAt))
    .map((r) => ({
      t: +new Date(r.measuredAt),
      sys: r.systolic,
      dia: r.diastolic,
      label: shortDay(new Date(r.measuredAt).toISOString().slice(0, 10)),
    }))

  if (points.length < 2) {
    return (
      <div className="flex h-40 items-center justify-center rounded-xl bg-paper text-sm text-muted">
        Log at least two readings to begin the trend chart.
      </div>
    )
  }

  const W = 640
  const H = height
  const padL = 34
  const padR = 10
  const padT = 12
  const padB = 24

  const allValues = points.flatMap((p) => [p.sys, p.dia])
  const yMin = Math.min(band.diastolicLow, ...allValues) - 8
  const yMax = Math.max(band.systolicHigh, ...allValues) + 8
  const tMin = points[0].t
  const tMax = points[points.length - 1].t || tMin + 1

  const x = (t: number) =>
    padL + ((t - tMin) / Math.max(1, tMax - tMin)) * (W - padL - padR)
  const y = (v: number) =>
    padT + (1 - (v - yMin) / Math.max(1, yMax - yMin)) * (H - padT - padB)

  const path = (key: 'sys' | 'dia') =>
    points.map((p, i) => `${i ? 'L' : 'M'}${x(p.t).toFixed(1)},${y(p[key]).toFixed(1)}`).join(' ')

  const gridValues = [yMin, (yMin + yMax) / 2, yMax].map(Math.round)

  return (
    <figure className="space-y-2">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full"
        role="img"
        aria-label="Blood pressure trend: systolic and diastolic over time"
      >
        {/* Home reference band */}
        <rect
          x={padL}
          y={y(band.systolicHigh)}
          width={W - padL - padR}
          height={Math.max(0, y(band.diastolicLow) - y(band.systolicHigh))}
          fill="#e7f5f1"
        />
        {gridValues.map((v) => (
          <g key={v}>
            <line
              x1={padL}
              x2={W - padR}
              y1={y(v)}
              y2={y(v)}
              stroke="#dde5e2"
              strokeWidth="1"
            />
            <text x={4} y={y(v) + 4} fontSize="10" fill="#66748b">
              {v}
            </text>
          </g>
        ))}

        <path d={path('sys')} fill="none" stroke="#ee6956" strokeWidth="2.5" />
        <path d={path('dia')} fill="none" stroke="#507fc6" strokeWidth="2.5" />

        {points.map((p, i) => (
          <g key={i}>
            <circle cx={x(p.t)} cy={y(p.sys)} r="3" fill="#ee6956" />
            <circle cx={x(p.t)} cy={y(p.dia)} r="3" fill="#507fc6" />
          </g>
        ))}

        <text x={padL} y={H - 6} fontSize="10" fill="#66748b">
          {points[0].label}
        </text>
        <text x={W - padR} y={H - 6} fontSize="10" fill="#66748b" textAnchor="end">
          {points[points.length - 1].label}
        </text>
      </svg>

      <figcaption className="flex flex-wrap gap-4 text-xs text-muted">
        <span className="flex items-center gap-1.5">
          <span className="h-1 w-4 rounded bg-coral" aria-hidden /> Systolic
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-1 w-4 rounded bg-blue" aria-hidden /> Diastolic
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-4 rounded bg-mint" aria-hidden /> Home reference band
        </span>
      </figcaption>
    </figure>
  )
}
