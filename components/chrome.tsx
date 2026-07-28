'use client'

import { useRouter } from 'next/navigation'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from 'react'

export type SheetName = 'sos' | 'bp' | 'add'
type Sync = 'idle' | 'saving' | 'synced'

interface Chrome {
  sheet: SheetName | null
  openSheet: (name: SheetName) => void
  closeSheet: () => void
  /** Show a transient message above the bottom nav. */
  notify: (message: string) => void
  /**
   * Run a server action with the header sync indicator and a success toast.
   * Every write in the app goes through here so the caregiver always sees
   * whether the shared record actually took the change.
   */
  run: (action: () => Promise<unknown>, successMessage?: string) => void
  pending: boolean
  sync: Sync
}

const ChromeContext = createContext<Chrome | null>(null)

export function useChrome(): Chrome {
  const ctx = useContext(ChromeContext)
  if (!ctx) throw new Error('useChrome must be used inside <ChromeProvider>')
  return ctx
}

export function ChromeProvider({ children }: { children: ReactNode }) {
  const router = useRouter()
  const [sheet, setSheet] = useState<SheetName | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [sync, setSync] = useState<Sync>('idle')
  const [pending, startTransition] = useTransition()
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])

  const after = useCallback((ms: number, fn: () => void) => {
    timers.current.push(setTimeout(fn, ms))
  }, [])

  useEffect(() => {
    const list = timers.current
    return () => list.forEach(clearTimeout)
  }, [])

  const notify = useCallback(
    (message: string) => {
      setToast(message)
      after(2400, () => setToast((current) => (current === message ? null : current)))
    },
    [after],
  )

  const run = useCallback<Chrome['run']>(
    (action, successMessage) => {
      setSync('saving')
      startTransition(async () => {
        try {
          await action()
          router.refresh()
          setSync('synced')
          if (successMessage) notify(successMessage)
          after(2200, () => setSync((s) => (s === 'synced' ? 'idle' : s)))
        } catch (error) {
          setSync('idle')
          notify(error instanceof Error ? error.message : 'Could not save that.')
        }
      })
    },
    [after, notify, router],
  )

  // Escape closes whichever sheet is open.
  useEffect(() => {
    if (!sheet) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setSheet(null)
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [sheet])

  const value = useMemo<Chrome>(
    () => ({
      sheet,
      openSheet: setSheet,
      closeSheet: () => setSheet(null),
      notify,
      run,
      pending,
      sync,
    }),
    [notify, pending, run, sheet, sync],
  )

  return (
    <ChromeContext.Provider value={value}>
      {children}
      {toast ? (
        <p
          role="status"
          className="animate-toast-in fixed bottom-24 left-1/2 z-60 -translate-x-1/2 rounded-full bg-navy px-4 py-2.5 text-[13px] font-semibold whitespace-nowrap text-white shadow-[0_8px_24px_rgba(19,34,56,.35)] no-print"
        >
          {toast}
        </p>
      ) : null}
    </ChromeContext.Provider>
  )
}

/** The `· saving…` / `· synced ✓` text beside the app name in the header. */
export function SyncLabel() {
  const { sync } = useChrome()
  if (sync === 'idle') return null
  return (
    <span
      className={`text-[10px] font-semibold ${sync === 'synced' ? 'text-teal' : 'text-muted'}`}
    >
      {sync === 'saving' ? (
        <>
          <span className="lang-en">· saving…</span>
          <span className="lang-hi">· सहेजा जा रहा…</span>
        </>
      ) : (
        <>
          <span className="lang-en">· synced ✓</span>
          <span className="lang-hi">· सिंक हो गया ✓</span>
        </>
      )}
    </span>
  )
}

/** A button that opens one of the bottom sheets from anywhere, including a
 *  server component. */
export function SheetTrigger({
  sheet,
  className,
  children,
  ...rest
}: {
  sheet: SheetName
  className?: string
  children: ReactNode
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onClick' | 'children'>) {
  const { openSheet } = useChrome()
  return (
    <button type="button" onClick={() => openSheet(sheet)} className={className} {...rest}>
      {children}
    </button>
  )
}

/**
 * The bottom-sheet shell: backdrop, drag handle, title row, close button.
 * `role="dialog"` and Escape-to-close are relied on by the smoke test.
 */
export function Sheet({
  name,
  title,
  eyebrow,
  intro,
  children,
  footer,
}: {
  name: SheetName
  title: ReactNode
  eyebrow?: ReactNode
  intro?: ReactNode
  children: ReactNode
  footer?: ReactNode
}) {
  const { sheet, closeSheet } = useChrome()
  if (sheet !== name) return null

  return (
    <div
      className="animate-fade-in fixed inset-0 z-50 flex items-end justify-center bg-navy/45 no-print"
      onMouseDown={(e) => e.target === e.currentTarget && closeSheet()}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="animate-sheet-up noscroll max-h-[92dvh] w-full max-w-[var(--shell-width)] overflow-y-auto rounded-t-3xl bg-paper px-4 pt-2.5 pb-[calc(1.125rem+env(safe-area-inset-bottom))]"
      >
        <div className="mx-auto mb-3 h-1 w-9 rounded-full bg-line" />
        <div className="flex items-start justify-between gap-2.5">
          <div className="min-w-0">
            {eyebrow ? <p className="eyebrow text-coral">{eyebrow}</p> : null}
            <h2 className="mt-0.5 text-lg font-extrabold text-navy">{title}</h2>
          </div>
          <button
            type="button"
            onClick={closeSheet}
            aria-label="Close"
            className="h-8 w-8 shrink-0 rounded-full border border-line bg-white text-[15px] text-muted transition active:scale-90"
          >
            ×
          </button>
        </div>
        {intro ? (
          <p className="mt-1.5 text-[11.5px] leading-relaxed text-muted">{intro}</p>
        ) : null}
        <div className="mt-3">{children}</div>
        {footer}
      </div>
    </div>
  )
}
