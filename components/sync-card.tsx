'use client'

import { useEffect, useState } from 'react'
import { prettyCareCode } from '@/lib/care-code'

export function SyncCard({ code }: { code: string }) {
  const [origin, setOrigin] = useState('')
  const [copied, setCopied] = useState<'link' | 'code' | null>(null)

  useEffect(() => setOrigin(window.location.origin), [])
  const link = `${origin}/c/${code}`

  async function copy(what: 'link' | 'code') {
    try {
      await navigator.clipboard.writeText(what === 'link' ? link : code)
      setCopied(what)
      setTimeout(() => setCopied(null), 2000)
    } catch {
      setCopied(null)
    }
  }

  async function share() {
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Dheer Recovery care link', url: link })
        return
      } catch {
        /* user cancelled — fall through to copy */
      }
    }
    copy('link')
  }

  return (
    <section className="card space-y-3">
      <div>
        <p className="eyebrow">Family sync</p>
        <h2 className="mt-1 text-base font-bold text-navy">
          One private link opens the same record on every phone
        </h2>
        <p className="mt-1 text-xs leading-relaxed text-muted">
          No separate login is needed. Anyone with the caregiver link can view and
          edit the family record, so treat the link like a password and share it
          only with trusted caregivers.
        </p>
      </div>

      <label className="block space-y-1">
        <span className="eyebrow">Family sync code / परिवार सिंक कोड</span>
        <input
          readOnly
          value={prettyCareCode(code)}
          onFocus={(e) => e.currentTarget.select()}
          className="field font-mono text-sm tracking-widest"
        />
      </label>

      <div className="grid gap-2 sm:grid-cols-2">
        <button type="button" onClick={share} className="btn-primary">
          {copied === 'link' ? 'Link copied ✓' : 'Share caregiver link'}
        </button>
        <button type="button" onClick={() => copy('code')} className="btn-ghost">
          {copied === 'code' ? 'Code copied ✓' : 'Copy code'}
        </button>
      </div>

      <p className="rounded-xl bg-coral-soft px-3 py-2.5 text-xs leading-relaxed text-ink">
        Save this link now. It is the only way back into this record — there is no
        password reset.
      </p>
    </section>
  )
}
