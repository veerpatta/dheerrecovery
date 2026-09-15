import type { WeightReading } from '@/db/schema'
import { careDate, shortDay } from '@/lib/time'
import { formatKg, type WeightBand } from '@/lib/weight'

/**
 * Plain inline SVG: no chart library, no client JS, prints correctly in the
 * doctor report. Readings are expected newest-first.
 *
 * Deliberately not a mode of BpChart. That chart's band is drawn between two
 * series that bracket it, which is geometry a single line with a baseline
 * reference does not share — the two pictures only look alike from a distance.
 */
export function WeightChart({
  readings,
  band,
  baselineGrams,
  width = 352,
  height = 170,
}: {
  readings: WeightReading[]
  band: WeightBand
  baselineGrams: number
  width?: number
  height?: number
}) {
  const points = [...readings]
    .sort((a, b) => +new Date(a.measuredAt) - +new Date(b.measuredAt))
    .map((r) => ({
      t: +new Date(r.measuredAt),
      g: r.grams,
      // The care date, not the UTC date — an evening reading is otherwise
      // labelled with tomorrow.
      label: shortDay(careDate(new Date(r.measuredAt))),
    }))

  if (points.length < 2) {
    return (
      <div className="flex h-30 items-center justify-center rounded-xl bg-paper px-4 text-center text-[12.5px] text-muted">
        Log at least two weights to begin the trend chart.
      </div>
    )
  }

  const W = width
  const H = height
  const padL = 34
  const padR = 8
  const padT = 10
  const padB = 22

  const values = points.map((p) => p.g)
  const yMin = Math.min(band.lowGrams, baselineGrams, ...values) - 1000
  const yMax = Math.max(band.highGrams, baselineGrams, ...values) + 1000
  const tMin = points[0].t
  const tMax = points[points.length - 1].t || tMin + 1

  const x = (t: number) =>
    padL + ((t - tMin) / Math.max(1, tMax - tMin)) * (W - padL - padR)
  const y = (v: number) =>
    padT + (1 - (v - yMin) / Math.max(1, yMax - yMin)) * (H - padT - padB)

  const path = points
    .map((p, i) => `${i ? 'L' : 'M'}${x(p.t).toFixed(1)},${y(p.g).toFixed(1)}`)
    .join(' ')

  const gridValues = [yMin, (yMin + yMax) / 2, yMax].map((v) => Math.round(v / 100) * 100)

  return (
    <figure className="flex flex-col gap-1.5">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full"
        role="img"
        aria-label="Weight trend over time, against the home reference band and the recorded baseline"
      >
        {/* Home reference band */}
        <rect
          x={padL}
          y={y(band.highGrams)}
          width={W - padL - padR}
          height={Math.max(0, y(band.lowGrams) - y(band.highGrams))}
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
            <text x={2} y={y(v) + 4} fontSize="10" fill="#66748b">
              {formatKg(v)}
            </text>
          </g>
        ))}

        {/* The baseline the percentage change is measured from. */}
        <line
          x1={padL}
          x2={W - padR}
          y1={y(baselineGrams)}
          y2={y(baselineGrams)}
          stroke="#66748b"
          strokeWidth="1.5"
          strokeDasharray="4 3"
        />

        <path d={path} fill="none" stroke="#29a997" strokeWidth="2.5" />
        {points.map((p, i) => (
          <circle key={i} cx={x(p.t)} cy={y(p.g)} r="3" fill="#29a997" />
        ))}

        <text x={padL} y={H - 6} fontSize="10" fill="#66748b">
          {points[0].label}
        </text>
        <text x={W - padR} y={H - 6} fontSize="10" fill="#66748b" textAnchor="end">
          {points[points.length - 1].label}
        </text>
      </svg>

      <figcaption className="flex flex-wrap gap-3.5 text-[11px] text-muted">
        <span className="flex items-center gap-1.5">
          <span className="h-1 w-4 rounded bg-teal" aria-hidden /> Weight
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-px w-4 border-t-2 border-dashed border-muted" aria-hidden />{' '}
          Baseline {formatKg(baselineGrams)} kg
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-4 rounded bg-mint" aria-hidden /> Home reference band
        </span>
      </figcaption>
    </figure>
  )
}
