'use client'

import { useEffect, useState } from 'react'
import { logWeight } from '@/lib/actions'
import {
  classifyWeight,
  formatDeltaKg,
  formatKg,
  formatPercent,
  lossFromBaseline,
  type WeightBand,
} from '@/lib/weight'
import { Sheet, useAction, useChrome } from './chrome'

type Field = 'kg' | 'tenths'

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

const CONTEXTS = ['Before breakfast', 'After radiotherapy', 'Evening'] as const

const empty = { kg: '', tenths: '', field: 'kg' as Field }

/**
 * Weight entry on the same numeric keypad as blood pressure.
 *
 * The decimal place gets its own tile rather than a "." key on the pad. A pad
 * with a decimal point accepts 8.8.6 and would have to give up the clear key to
 * make room; two tiles cannot express a malformed number at all, and reuse the
 * BP sheet's `press` semantics exactly. An 88 kg reading costs one tap on the
 * tenths tile — the same trade the BP sheet already makes for a two-digit
 * diastolic.
 */
export function WeightSheet({
  band,
  baselineGrams,
}: {
  band: WeightBand
  baselineGrams: number
}) {
  const { sheet, closeSheet } = useChrome()
  const { run, busy: pending } = useAction()
  const [draft, setDraft] = useState(empty)
  const [extra, setExtra] = useState({ context: '', note: '', measuredAt: '' })

  const open = sheet === 'weight'
  // A fresh sheet on every open — a stale half-typed weight is a wrong one.
  useEffect(() => {
    if (!open) {
      setDraft(empty)
      setExtra({ context: '', note: '', measuredAt: '' })
    }
  }, [open])

  const kg = Number(draft.kg)
  const grams = draft.kg === '' ? 0 : Math.round(kg) * 1000 + Number(draft.tenths || '0') * 100
  const canSave = draft.kg !== '' && grams >= 25_000 && grams <= 200_000

  const hint =
    draft.kg !== '' && !canSave ? 'Weight must be between 25.0 and 200.0 kg.' : null

  function press(key: string) {
    setDraft((d) => {
      const next = { ...d }
      if (key === 'C') return { ...empty }
      if (key === 'back') {
        if (next[d.field]) next[d.field] = next[d.field].slice(0, -1)
        else next.field = 'kg'
        return next
      }
      const max = d.field === 'kg' ? 3 : 1
      if (next[d.field].length < max) next[d.field] += key
      // The tenths tile holds one digit, so it is full the moment it is typed.
      if (d.field === 'tenths') return next
      // Three whole kilograms can only be a full reading; two might not be.
      if (next.kg.length === 3) next.field = 'tenths'
      return next
    })
  }

  // Hardware keyboard: real accessibility, and it makes the sheet testable.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (/^[0-9]$/.test(e.key)) press(e.key)
      else if (e.key === 'Backspace') press('back')
      else if (e.key === '.' || e.key === ',') setDraft((d) => ({ ...d, field: 'tenths' }))
      else return
      e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  function save() {
    if (!canSave) return
    const fd = new FormData()
    fd.set('kg', (grams / 1000).toFixed(1))
    for (const [k, v] of Object.entries(extra)) if (v) fd.set(k, v)

    run(async () => {
      await logWeight(fd)
      closeSheet()
    }, `Saved ${formatKg(grams)} kg ✓`)
  }

  const preview = canSave ? classifyWeight(grams, band) : null
  const change = canSave ? lossFromBaseline(grams, baselineGrams) : null
  const previewStyle =
    preview === 'low'
      ? 'bg-coral-soft text-coral'
      : preview === 'high'
        ? 'bg-amber/20 text-amber-ink'
        : 'bg-mint text-teal'

  const TILES: { key: Field; en: string; hi: string; value: string }[] = [
    { key: 'kg', en: 'Kilograms', hi: 'किलोग्राम', value: draft.kg || '—' },
    { key: 'tenths', en: 'Decimal', hi: 'दशमलव', value: `.${draft.tenths || '0'}` },
  ]

  return (
    <Sheet
      name="weight"
      title={
        <>
          <span className="lang-en">Log weight</span>
          <span className="lang-hi">वज़न दर्ज करें</span>
        </>
      }
      intro="Weigh at the same time of day each time — before breakfast is the steadiest."
    >
      <div className="grid grid-cols-2 gap-2">
        {TILES.map((t) => (
          <button
            key={t.key}
            type="button"
            data-weight-field={t.key}
            aria-label={`${t.en}${draft[t.key] ? `, ${draft[t.key]}` : ', empty'}`}
            onClick={() => setDraft((d) => ({ ...d, field: t.key }))}
            className={`rounded-2xl border-2 bg-white px-1.5 py-2.5 text-center transition-colors ${
              draft.field === t.key ? 'border-teal' : 'border-line'
            }`}
          >
            <span className="block text-[9.5px] font-semibold tracking-[0.1em] text-muted uppercase">
              <span className="lang-en">{t.en}</span>
              <span className="lang-hi">{t.hi}</span>
            </span>
            <span
              className={`mt-0.5 block text-[26px] font-extrabold ${
                draft[t.key] ? 'text-navy' : 'text-line'
              }`}
            >
              {t.value}
            </span>
          </button>
        ))}
      </div>

      {preview && change ? (
        <p className="mt-2.5 flex flex-wrap justify-center gap-1.5">
          <span className={`pill ${previewStyle}`}>
            {formatKg(grams)} kg ·{' '}
            {preview === 'low' ? 'Below band' : preview === 'high' ? 'Above band' : 'In band'}
          </span>
          <span
            className={`pill ${change.flagged ? 'bg-coral-soft text-coral' : 'bg-line/50 text-muted'}`}
          >
            {formatDeltaKg(change.deltaGrams)} · {formatPercent(change.percent)} from
            baseline
          </span>
        </p>
      ) : null}
      {hint ? (
        <p className="mt-2.5 text-center text-xs font-semibold text-coral">{hint}</p>
      ) : null}

      <div className="mt-3 grid grid-cols-3 gap-2">
        {PAD.map((k) => (
          <button
            key={k}
            type="button"
            data-weight-key={k}
            aria-label={k === 'back' ? 'Delete' : k === 'C' ? 'Clear' : k}
            onClick={() => press(k)}
            className="h-14 rounded-2xl border border-line bg-white text-[22px] font-bold text-navy transition active:scale-95 active:bg-mint"
          >
            {k === 'back' ? <BackspaceIcon /> : k}
          </button>
        ))}
      </div>

      <details className="mt-3">
        <summary className="flex items-center gap-1 text-xs font-bold text-teal">
          Add context, a note, or a past time
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
              value={extra.context}
              onChange={(e) => setExtra((c) => ({ ...c, context: e.target.value }))}
              className="field"
            >
              <option value="">Not recorded</option>
              {CONTEXTS.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <label className="block space-y-1">
            <span className="eyebrow">Note</span>
            <input
              type="text"
              value={extra.note}
              onChange={(e) => setExtra((c) => ({ ...c, note: e.target.value }))}
              className="field"
              placeholder="Anything worth remembering"
            />
          </label>
          <label className="block space-y-1">
            <span className="eyebrow">Measured at</span>
            <input
              type="datetime-local"
              value={extra.measuredAt}
              onChange={(e) => setExtra((c) => ({ ...c, measuredAt: e.target.value }))}
              className="field"
            />
          </label>
        </div>
      </details>

      <button
        type="button"
        disabled={!canSave || pending}
        aria-label="Save weight"
        onClick={save}
        className={`mt-3 h-14 w-full rounded-2xl text-[17px] font-bold text-white transition active:scale-[0.97] ${
          canSave ? 'bg-teal' : 'bg-sage'
        }`}
      >
        {canSave ? `Save ${formatKg(grams)} kg ✓` : 'Save weight'}
      </button>
    </Sheet>
  )
}
