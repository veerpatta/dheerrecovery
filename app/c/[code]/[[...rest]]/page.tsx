import { permanentRedirect } from 'next/navigation'

/**
 * The app used to live under /c/<care-code>/…. Those links are on caregivers'
 * phones and in shared messages, so they keep working: everything under /c/
 * redirects to the same page at the top level.
 */
export default async function LegacyCareLink({
  params,
}: {
  params: Promise<{ code: string; rest?: string[] }>
}) {
  const { rest } = await params
  permanentRedirect(`/${(rest ?? []).join('/')}`)
}
