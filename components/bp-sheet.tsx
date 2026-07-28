'use client'

import { useEffect, useState } from 'react'
import { logBp } from '@/lib/actions'
import { classify, type Band } from '@/lib/bp'
import { Sheet, useChrome } from './chrome'

type Field = 'systolic' | 'diastolic' | 'pulse'

const FIELDS: { key: Field; en: string; hi: string }[] = [
  { key: 'systolic', en: 'Systolic', hi: 'सिस्टोलिक' },
  { key: 'diastolic', en: 'Diastolic', hi: 'डायस्टोलिक' },
  { key: 'pulse', en: 'Pulse', hi: 'नाड़ी' },
]

/** Kept in full — the six the app already recorded, not the design's three. */
const SYMPTOMS = [
  'Dizziness',
  'Headache',
  'Weakness',
  'Blurred vision',
  'Chest discomfort',
  'Breathlessness',
] as const

const PAD = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', 'back'] as const

/** U+232B is not in Inter, so it renders as tofu. Draw the key instead. */
function BackspaceIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="mx-auto"
      aria-hidden
    >
      <path d="M20 5H9L3 12l6 7h11a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1Z" />
      <path d="M16 9.5l-5 5M11 9.5l5 5" />
    </svg>
  )
}

const BOUNDS: Record<Field, [number, number]> = {
  systolic: [50, 260],
  diastolic: [30, 180],
  pulse: [20, 220],
}

const empty = {
  systolic: '',
  diastolic: '',
  pulse: '',
  field: 'systolic' as Field,
  symptoms: [] as string[],
}

/**
 * Numeric-keypad BP entry. A caregiver logging a reading at 6am should not
 * have to hit three small number spinners, so the whole sheet is thumb-sized
 * tap targets — but the hardware keyboard works too.
 */
export function BpSheet({
  band,
  lastReadingAt,
}: {
  band: Band
  lastReadingAt: Date | string | null
}) {
  const { sheet, closeSheet, run, pending, notify } = useChrome()
  const [draft, setDraft] = useState(empty)
  const [pairId, setPairId] = useState<string | null>(null)
  const [context, setContext] = useState({ context: '', position: '', arm: '', measuredAt: '' })

  const open = sheet === 'bp'
  // A fresh sheet on every open — a stale half-typed reading is a wrong one.
  useEffect(() => {
    if (!open) {
      setDraft(empty)
      setPairId(null)
      setContext({ context: '', position: '', arm: '', measuredAt: '' })
    }
  }, [open])

  const sys = Number(draft.systolic)
  const dia = Number(draft.diastolic)
  const pulse = Number(draft.pulse)
  const inBounds = (f: Field, v: number) => v >= BOUNDS[f][0] && v <= BOUNDS[f][1]
  const validSys = draft.systolic !== '' && inBounds('systolic', sys)
  const validDia = draft.diastolic !== '' && inBounds('diastolic', dia)
  const validPulse = draft.pulse === '' || inBounds('pulse', pulse)
  const canSave = validSys && validDia && validPulse

  const hint = (() => {
    if (draft.systolic !== '' && !validSys) return 'Systolic must be between 50 and 260.'
    if (draft.diastolic !== '' && !validDia) return 'Diastolic must be between 30 and 180.'
    if (!validPulse) return 'Pulse must be between 20 and 220.'
    return null
  })()

  function press(key: string) {
    setDraft((d) => {
      const next = { ...d }
      if (key === 'C') return { ...empty, symptoms: d.symptoms }
      if (key === 'back') {
        if (next[d.field]) next[d.field] = next[d.field].slice(0, -1)
        else next.field = d.field === 'pulse' ? 'diastolic' : 'systolic'
        return next
      }
      if (next[d.field].length < 3) next[d.field] += key
      // Auto-advance only on a full three digits; a two-digit diastolic is
      // committed by tapping the next tile, exactly as the design intends.
      if (next[d.field].length === 3) {
        next.field = d.field === 'systolic' ? 'diastolic' : 'pulse'
      }
      return next
    })
  }

  // Hardware keyboard: real accessibility, and it makes the sheet testable.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (/^[0-9]$/.test(e.key)) press(e.key)
      else if (e.key === 'Backspace') press('back')
      else return
      e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  function save(mode: 'single' | 'pair') {
    if (!canSave) return
    const fd = new FormData()
    fd.set('systolic', draft.systolic)
    fd.set('diastolic', draft.diastolic)
    if (draft.pulse) fd.set('pulse', draft.pulse)
    for (const s of draft.symptoms) fd.append('symptom', s)
    for (const [k, v] of Object.entries(context)) if (v) fd.set(k, v)
    if (pairId) fd.set('pairId', pairId)
    fd.set('mode', mode)

    const paired =
      lastReadingAt &&
      Date.now() - new Date(lastReadingAt).getTime() <= 5 * 60_000

    run(async () => {
      const result = await logBp(fd)
      if (mode === 'pair') {
        setPairId(result.pairId)
        setDraft((d) => ({ ...empty, symptoms: d.symptoms }))
        notify('First reading saved — rest a minute, then log the second.')
      } else {
        setPairId(null)
        closeSheet()
      }
    }, mode === 'single' ? `Saved ${sys}/${dia} ✓${paired ? ' · Paired session' : ''}` : undefined)
  }

  const preview = canSave ? classify({ systolic: sys, diastolic: dia }, band) : null
  const previewStyle =
    preview === 'high'
      ? 'bg-coral-soft text-coral'
      : preview === 'low'
        ? 'bg-amber/20 text-amber'
        : 'bg-mint text-teal'
  const previewLabel =
    preview === 'high' ? 'High' : preview === 'low' ? 'Low' : 'In band'

  return (
    <Sheet
      name="bp"
      title={
        <>
          <span className="lang-en">Log BP</span>
          <span className="lang-hi">BP दर्ज करें</span>
        </>
      }
      intro="Home BP is best measured as two readings about a minute apart — log both."
    >
      <div className="grid grid-cols-3 gap-2">
        {FIELDS.map((f) => (
          <button
            key={f.key}
            type="button"
            data-bp-field={f.key}
            aria-label={`${f.en}${draft[f.key] ? `, ${draft[f.key]}` : ', empty'}`}
            onClick={() => setDraft((d) => ({ ...d, field: f.key }))}
            className={`rounded-2xl border-2 bg-white px-1.5 py-2.5 text-center transition-colors ${
              draft.field === f.key ? 'border-teal' : 'border-line'
            }`}
          >
            <span className="block text-[9.5px] font-semibold tracking-[0.1em] text-muted uppercase">
              <span className="lang-en">{f.en}</span>
              <span className="lang-hi">{f.hi}</span>
            </span>
            <span
              className={`mt-0.5 block text-[26px] font-extrabold ${
                draft[f.key] ? 'text-navy' : 'text-line'
              }`}
            >
              {draft[f.key] || '—'}
            </span>
          </button>
        ))}
      </div>

      {preview ? (
        <p className="mt-2.5 flex justify-center">
          <span className={`pill ${previewStyle}`}>
            {sys}/{dia} · {previewLabel}
          </span>
        </p>
      ) : null}
      {hint ? (
        <p className="mt-2.5 text-center text-xs font-semibold text-coral">{hint}</p>
      ) : null}

      <div className="mt-2.5 flex flex-wrap gap-1.5">
        {SYMPTOMS.map((s) => {
          const on = draft.symptoms.includes(s)
          return (
            <button
              key={s}
              type="button"
              aria-pressed={on}
              onClick={() =>
                setDraft((d) => ({
                  ...d,
                  symptoms: on
                    ? d.symptoms.filter((x) => x !== s)
                    : [...d.symptoms, s],
                }))
              }
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition active:scale-95 ${
                on ? 'border-teal bg-mint text-teal' : 'border-line bg-white text-muted'
              }`}
            >
              {s}
            </button>
          )
        })}
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        {PAD.map((k) => (
          <button
            key={k}
            type="button"
            data-bp-key={k}
            aria-label={k === 'back' ? 'Delete' : k === 'C' ? 'Clear' : k}
            onClick={() => press(k)}
            className="h-14 rounded-2xl border border-line bg-white text-[22px] font-bold text-navy transition active:scale-95 active:bg-mint"
          >
            {k === 'back' ? <BackspaceIcon /> : k}
          </button>
        ))}
      </div>

      {/* The report and the Excel export print these columns, so the fields
          stay available even though the design's sheet drops them. */}
      <details className="mt-3">
        <summary className="flex items-center gap-1 text-xs font-bold text-teal">
          Add context, arm, or a past time
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
        <div className="flex flex-col gap-2 pt-2.5">
          <label className="block space-y-1">
            <span className="eyebrow">Context</span>
            <select
              value={context.context}
              onChange={(e) => setContext((c) => ({ ...c, context: e.target.value }))}
              className="field"
            >
              <option value="">Not recorded</option>
              <option>Resting</option>
              <option>After activity</option>
              <option>Before medicine</option>
              <option>After medicine</option>
              <option>Feeling unwell</option>
            </select>
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="space-y-1">
              <span className="eyebrow">Position</span>
              <select
                value={context.position}
                onChange={(e) => setContext((c) => ({ ...c, position: e.target.value }))}
                className="field"
              >
                <option value="">Not recorded</option>
                <option>Seated</option>
                <option>Lying down</option>
                <option>Standing</option>
              </select>
            </label>
            <label className="space-y-1">
              <span className="eyebrow">Arm</span>
              <select
                value={context.arm}
                onChange={(e) => setContext((c) => ({ ...c, arm: e.target.value }))}
                className="field"
              >
                <option value="">Not recorded</option>
                <option>Left</option>
                <option>Right</option>
              </select>
            </label>
          </div>
          <label className="block space-y-1">
            <span className="eyebrow">Measured at</span>
            <input
              type="datetime-local"
              value={context.measuredAt}
              onChange={(e) => setContext((c) => ({ ...c, measuredAt: e.target.value }))}
              className="field"
            />
          </label>
        </div>
      </details>

      {pairId ? (
        <p className="mt-3 rounded-xl bg-mint px-3 py-2 text-xs font-semibold text-teal">
          First reading saved. Rest quietly for about a minute, then log the second.
        </p>
      ) : null}

      <button
        type="button"
        disabled={!canSave || pending}
        aria-label="Save BP"
        onClick={() => save('single')}
        className={`mt-3 h-14 w-full rounded-2xl text-[17px] font-bold text-white transition active:scale-[0.97] ${
          canSave ? 'bg-teal' : 'bg-sage'
        }`}
      >
        {canSave ? `Save ${sys}/${dia} ✓` : 'Save BP'}
      </button>
      <button
        type="button"
        disabled={!canSave || pending}
        onClick={() => save('pair')}
        className="mt-2 w-full py-2 text-xs font-bold text-teal disabled:opacity-50"
      >
        {pairId ? 'Save and add another reading' : 'Save and add second reading'}
      </button>
    </Sheet>
  )
}
