'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { T } from './t'
import type { StringKey } from '@/lib/i18n'

const TABS: { seg: string; icon: string; k: StringKey }[] = [
  { seg: '', icon: '●', k: 'today' },
  { seg: 'chart', icon: '▤', k: 'fullChart' },
  { seg: 'history', icon: '↗', k: 'historyExport' },
  { seg: 'safety', icon: '!', k: 'safety' },
  { seg: 'logs', icon: '⌁', k: 'recoveryLogs' },
]

export function NavTabs({ code }: { code: string }) {
  const pathname = usePathname()
  const base = `/c/${code}`

  return (
    <nav className="-mx-4 mt-3 flex gap-1.5 overflow-x-auto px-4 pb-0.5">
      {TABS.map((tab) => {
        const href = tab.seg ? `${base}/${tab.seg}` : base
        const active = pathname === href
        return (
          <Link
            key={tab.seg || 'today'}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition ${
              active
                ? 'border-navy bg-navy text-white'
                : 'border-line bg-white text-muted hover:text-ink'
            }`}
          >
            <span aria-hidden>{tab.icon}</span>
            <T k={tab.k} />
          </Link>
        )
      })}
    </nav>
  )
}
