'use client'

export default function CareError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="card m-4 space-y-3 border-coral/40 bg-coral-soft">
      <p className="eyebrow text-coral">Something went wrong</p>
      <h2 className="text-base font-bold text-navy">
        The care record could not be loaded
      </h2>
      <p className="text-sm leading-relaxed text-ink/80">
        Nothing was changed. Try again — if it keeps happening, check that the
        database connection is configured.
      </p>
      <p className="font-mono text-xs break-all text-muted">{error.message}</p>
      <button type="button" onClick={reset} className="btn-danger">
        Try again
      </button>
    </div>
  )
}
