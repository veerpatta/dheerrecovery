'use client'

export function PrintButton() {
  return (
    <div className="no-print flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-paper px-4 py-3">
      <p className="text-sm text-muted">
        Use your browser’s print dialog and choose <strong>Save as PDF</strong>.
      </p>
      <button type="button" onClick={() => window.print()} className="btn-primary">
        Print / Save as PDF
      </button>
    </div>
  )
}
