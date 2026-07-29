'use client'

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

export type SheetName = 'sos' | 'bp' | 'add' | 'dose'
type Sync = 'idle' | 'saving' | 'synced'

/**
 * What a dose card should show *right now*, before the server has answered.
 *
 * A dose tap is a statement of fact — the tablet is already swallowed — so the
 * card has no business waiting on a network round-trip to admit it happened.
 * The sheet that records the time and the card that displays it are siblings,
 * so the pending truth is held here, keyed by dose, and dropped the moment the
 * server's own version arrives.
 */
export interface OptimisticDose {
  status: 'taken' | 'skipped' | 'not-recorded' | 'upcoming'
  takenClock: string | null
}

export const doseKey = (medicineId: string, slotKey: string, doseDate: string) =>
  `${medicineId}::${slotKey}::${doseDate}`

/**
 * Payload for the sheets that are opened *about* something: which dose is
 * being timed, or whether the add sheet is adding a routine or SOS medicine.
 * Carrying it here means one sheet instance serves every dose card, rather
 * than each card mounting a dialog of its own.
 */
export interface SheetPayload {
  medicineId?: string
  slotKey?: string
  doseDate?: string
  brand?: string
  /** The time the dose is due, "HH:MM" — derived for interval medicines. */
  dueTime?: string
  intervalHours?: number | null
  /** When the previous dose of the same medicine went in, for the gap read-out. */
  previousTakenAt?: string | null
  previousLabel?: string | null
  mode?: 'routine' | 'sos'
}

interface Chrome {
  sheet: SheetName | null
  payload: SheetPayload
  openSheet: (name: SheetName, payload?: SheetPayload) => void
  closeSheet: () => void
  /** Show a transient message above the bottom nav. */
  notify: (message: string) => void
  /**
   * Run a server action with the header sync indicator and a success toast.
   * Every write in the app goes through here so the caregiver always sees
   * whether the shared record actually took the change.
   *
   * `onSettled` fires once the write has resolved either way — `useAction`
   * uses it to keep "busy" local to the control that was pressed.
   */
  run: (
    action: () => Promise<unknown>,
    successMessage?: string,
    onSettled?: () => void,
  ) => void
  /** True while *any* write is in flight. Prefer `useAction` for a button. */
  pending: boolean
  sync: Sync
  /** Pending dose states, keyed by `doseKey`. */
  doses: Record<string, OptimisticDose>
  markDose: (key: string, value: OptimisticDose) => void
}

const ChromeContext = createContext<Chrome | null>(null)

export function useChrome(): Chrome {
  const ctx = useContext(ChromeContext)
  if (!ctx) throw new Error('useChrome must be used inside <ChromeProvider>')
  return ctx
}

/**
 * `run`, plus a `busy` flag scoped to the component that called it.
 *
 * The context's `pending` is global: it is true while *any* write is in
 * flight, so recording one dose greyed out every button on the timeline, both
 * floating buttons and the whole settings page for as long as the round-trip
 * took. That is most of what "laggy" meant here — the app was not slow so much
 * as switched off. Only the control that was actually pressed should wait.
 */
export function useAction(): { run: Chrome['run']; busy: boolean } {
  const { run: runGlobal } = useChrome()
  const [busy, setBusy] = useState(false)
  const alive = useRef(true)
  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])

  const run = useCallback<Chrome['run']>(
    (action, message, onSettled) => {
      setBusy(true)
      runGlobal(action, message, () => {
        if (alive.current) setBusy(false)
        onSettled?.()
      })
    },
    [runGlobal],
  )

  return { run, busy }
}

export function ChromeProvider({ children }: { children: ReactNode }) {
  const [sheet, setSheet] = useState<SheetName | null>(null)
  const [payload, setPayload] = useState<SheetPayload>({})
  const [toast, setToast] = useState<string | null>(null)
  const [sync, setSync] = useState<Sync>('idle')
  const [doses, setDoses] = useState<Record<string, OptimisticDose>>({})
  const [pending, startTransition] = useTransition()
  const timers = useRef<Set<ReturnType<typeof setTimeout>>>(new Set())

  /*
   * Handles are dropped as they fire. This used to be an array that only ever
   * grew — every toast and every sync badge left a dead handle behind, for the
   * whole of a caregiving day on a tab that is never closed.
   */
  const after = useCallback((ms: number, fn: () => void) => {
    const set = timers.current
    const id = setTimeout(() => {
      set.delete(id)
      fn()
    }, ms)
    set.add(id)
  }, [])

  useEffect(() => {
    const set = timers.current
    return () => {
      set.forEach(clearTimeout)
      set.clear()
    }
  }, [])

  const notify = useCallback(
    (message: string) => {
      setToast(message)
      after(2400, () => setToast((current) => (current === message ? null : current)))
    },
    [after],
  )

  /*
   * There is no `router.refresh()` here on purpose. Every action calls
   * `revalidatePath`, so the Server Action's own response already carries the
   * re-rendered tree — refreshing on top of it rendered the whole page a
   * second time and cost a second round-trip. One dose tap used to run 27
   * database queries; the duplicate render was 10 of them.
   *
   * Clearing the optimistic doses inside the same transition means the
   * server's version replaces the local one in a single commit, with no frame
   * in between where the card flickers back to its old state.
   */
  const run = useCallback<Chrome['run']>(
    (action, successMessage, onSettled) => {
      setSync('saving')
      startTransition(async () => {
        try {
          await action()
          setDoses({})
          setSync('synced')
          if (successMessage) notify(successMessage)
          after(2200, () => setSync((s) => (s === 'synced' ? 'idle' : s)))
        } catch (error) {
          setDoses({})
          setSync('idle')
          notify(error instanceof Error ? error.message : 'Could not save that.')
        } finally {
          onSettled?.()
        }
      })
    },
    [after, notify],
  )

  const markDose = useCallback<Chrome['markDose']>((key, value) => {
    setDoses((current) => ({ ...current, [key]: value }))
  }, [])

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
      payload,
      openSheet: (name, next = {}) => {
        setPayload(next)
        setSheet(name)
      },
      closeSheet: () => setSheet(null),
      notify,
      run,
      pending,
      sync,
      doses,
      markDose,
    }),
    [doses, markDose, notify, payload, pending, run, sheet, sync],
  )

  return (
    <ChromeContext.Provider value={value}>
      {children}
      {/* A hairline under the header while a write is in flight. It is the
          only thing on screen that waits for the server, and it costs one
          composited transform rather than disabling half the interface. */}
      {sync === 'saving' ? <span className="sync-bar no-print" aria-hidden /> : null}
      {toast ? (
        <p
          role="status"
          /*
           * Above the nav normally. While a sheet is open the same spot lands
           * in the middle of the sheet's controls, so it moves to the top —
           * a toast that covers the button you are reaching for is worse than
           * no toast.
           */
          className={`animate-toast-in fixed left-1/2 z-60 -translate-x-1/2 rounded-full bg-navy px-4 py-2.5 text-[13px] font-semibold whitespace-nowrap text-white shadow-[0_8px_24px_rgba(19,34,56,.35)] no-print ${
            sheet ? 'top-4' : 'bottom-24'
          }`}
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
  payload,
  className,
  children,
  ...rest
}: {
  sheet: SheetName
  payload?: SheetPayload
  className?: string
  children: ReactNode
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onClick' | 'children'>) {
  const { openSheet } = useChrome()
  return (
    <button
      type="button"
      onClick={() => openSheet(sheet, payload)}
      className={className}
      {...rest}
    >
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
