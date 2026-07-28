import Link from 'next/link'

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-4 px-5 text-center">
      <p className="eyebrow">Care record not found</p>
      <h1 className="text-2xl font-bold tracking-tight text-navy">
        That care link does not open a record
      </h1>
      <p className="text-sm leading-relaxed text-muted">
        Check the link for a typo, or ask another caregiver to re-share it. Care
        links are the only way into a record — there is no password reset.
      </p>
      <Link href="/" className="btn-primary">
        Back to start
      </Link>
    </main>
  )
}
