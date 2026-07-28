'use client'

import { useActionState, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { openExistingRecord, startNewRecord } from '@/lib/actions'

function Submit({ children, className }: { children: string; className: string }) {
  const { pending } = useFormStatus()
  return (
    <button type="submit" className={className} disabled={pending}>
      {pending ? 'Working…' : children}
    </button>
  )
}

export function EntryForms() {
  const [mode, setMode] = useState<'new' | 'open'>('new')
  const [state, action] = useActionState(
    async (_prev: { error?: string } | null, formData: FormData) =>
      (await openExistingRecord(formData)) ?? null,
    null,
  )

  return (
    <div className="card space-y-4">
      <div className="grid grid-cols-2 gap-2 rounded-xl bg-paper p-1">
        <button
          type="button"
          onClick={() => setMode('new')}
          className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
            mode === 'new' ? 'bg-white text-navy shadow-sm' : 'text-muted'
          }`}
        >
          Start a record
        </button>
        <button
          type="button"
          onClick={() => setMode('open')}
          className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
            mode === 'open' ? 'bg-white text-navy shadow-sm' : 'text-muted'
          }`}
        >
          I have a code
        </button>
      </div>

      {mode === 'new' ? (
        <form action={startNewRecord} className="space-y-3">
          <p className="text-sm leading-relaxed text-muted">
            Creates a fresh family record pre-loaded with the five routine medicines
            and five SOS guides from the prescription. You will get a private care
            link to share with other caregivers.
          </p>
          <Submit className="btn-primary w-full">Create care record</Submit>
        </form>
      ) : (
        <form action={action} className="space-y-3">
          <label className="block space-y-1.5">
            <span className="eyebrow">Family sync code / परिवार सिंक कोड</span>
            <input
              name="careCode"
              required
              autoComplete="off"
              spellCheck={false}
              placeholder="ABCDE-FGHJK-LMNPQ-RSTUV"
              className="field font-mono tracking-widest uppercase"
            />
          </label>
          {state?.error ? (
            <p className="text-sm font-medium text-coral">{state.error}</p>
          ) : null}
          <Submit className="btn-primary w-full">Open care record</Submit>
        </form>
      )}
    </div>
  )
}
