'use client'

import Link from 'next/link'
import { T } from './t'

/** Fixed bottom bar — the two things a caregiver reaches for mid-task. */
export function QuickBar({ code }: { code: string }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white/95 px-4 py-3 backdrop-blur no-print">
      <div className="mx-auto flex max-w-3xl items-center gap-2">
        <Link href={`/c/${code}/logs#log-bp`} className="btn-primary flex-1">
          <span aria-hidden>♥</span>
          <T k="logBp" />
        </Link>
        <Link href={`/c/${code}/settings#add-medicine`} className="btn-ghost flex-1">
          <T k="addMedicine" />
        </Link>
      </div>
    </div>
  )
}
