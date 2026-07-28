/**
 * The doctor report is a printed document, not an app screen. It renders
 * outside the phone shell so page breaks, margins and wide tables all survive
 * a trip to the printer.
 */
export const dynamic = 'force-dynamic'

export default function PrintLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto min-h-dvh w-full max-w-3xl bg-white px-4 py-6">
      {children}
    </div>
  )
}
