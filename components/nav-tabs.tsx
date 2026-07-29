'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { T } from './t'
import type { StringKey } from '@/lib/i18n'

/** Bottom tab bar. Icons are inline so nothing is fetched at paint. */
const TABS: { seg: string; k: StringKey; icon: React.ReactNode }[] = [
  {
    seg: '',
    k: 'today',
    icon: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M8.5 12.5l2.5 2.5 4.5-5" />
      </>
    ),
  },
  { seg: 'chart', k: 'tabChart', icon: <path d="M4 6h16M4 12h16M4 18h10" /> },
  { seg: 'logs', k: 'tabLogs', icon: <path d="M3 12h4l2-6 4 12 2-6h6" /> },
  {
    seg: 'history',
    k: 'tabHistory',
    icon: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 3" />
      </>
    ),
  },
  {
    seg: 'safety',
    k: 'safety',
    icon: <path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z" />,
  },
]

export function NavTabs() {
  const pathname = usePathname()
  /*
   * The tab lights up on the tap, not on the server's answer. These routes are
   * all dynamic, so `pathname` does not move until the new page has rendered —
   * which left the tap looking ignored for as long as the round-trip took, and
   * invited a second tap. The optimistic target is dropped as soon as the real
   * path agrees with it, or if the navigation is abandoned.
   */
  const [target, setTarget] = useState<string | null>(null)
  useEffect(() => setTarget(null), [pathname])

  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 mx-auto flex w-full max-w-[var(--shell-width)] border-t border-line bg-white px-1.5 pt-1.5 pb-[calc(0.5rem+env(safe-area-inset-bottom))] no-print">
      {TABS.map((tab) => {
        const href = tab.seg ? `/${tab.seg}` : '/'
        const current = pathname === href
        const active = target ? target === href : current
        return (
          <Link
            key={tab.seg || 'today'}
            href={href}
            /*
             * Default prefetch, deliberately not `prefetch` — these routes are
             * dynamic, so a forced prefetch caches the whole page for thirty
             * seconds and this record is shared between caregivers. The
             * default warms the shared layout and the loading skeleton, which
             * is what makes the tap land instantly, and still renders the
             * data fresh every time.
             */
            onClick={() => setTarget(href)}
            aria-current={current ? 'page' : undefined}
            className={`flex flex-1 flex-col items-center gap-0.5 py-1 transition-transform duration-100 active:scale-95 ${
              active ? 'text-navy' : 'text-muted'
            }`}
          >
            <span
              className={`flex rounded-full px-[15px] py-1 transition-colors duration-150 ${
                active ? 'bg-mint' : 'bg-transparent'
              }`}
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                {tab.icon}
              </svg>
            </span>
            <span className="text-[10px] font-bold">
              <T k={tab.k} />
            </span>
          </Link>
        )
      })}
    </nav>
  )
}
