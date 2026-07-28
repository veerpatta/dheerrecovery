import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="card space-y-3 text-center">
      <p className="eyebrow">Page not found</p>
      <h1 className="text-xl font-bold tracking-tight text-navy">
        There is nothing at this address
      </h1>
      <p className="text-sm leading-relaxed text-muted">
        The care record itself is fine — only this link is wrong.
      </p>
      <Link href="/" className="btn-primary">
        Back to today’s medicines
      </Link>
    </div>
  )
}
