/**
 * Shown the instant a tab is tapped, while the real screen renders.
 *
 * Every page here is `force-dynamic`, so a tab tap costs a server render and a
 * database read before anything can change on screen. Without a boundary the
 * browser simply sat on the old page for that whole time, which reads as a
 * dropped tap — the caregiver taps again, and now there are two navigations in
 * flight. The skeleton makes the tap land immediately and keeps the header and
 * the bottom nav in place while the content arrives.
 *
 * Deliberately shaped like the screens it stands in for — a summary card, a
 * dark block, then a list — so the layout does not jump when the real content
 * replaces it.
 */
export default function ShellLoading() {
  return (
    <div className="flex flex-col gap-3" aria-busy="true" aria-label="Loading">
      <div className="card flex items-center gap-4">
        <span className="skeleton h-[76px] w-[76px] shrink-0 rounded-full" />
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <span className="skeleton h-2.5 w-14 rounded-full" />
          <span className="skeleton h-4 w-40 rounded-full" />
          <span className="skeleton h-2.5 w-28 rounded-full" />
        </div>
      </div>

      <div className="skeleton h-[168px] rounded-2xl" data-dark="true" />

      <div className="flex flex-col gap-2.5 pt-1">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="rail-row">
            <div className="rail-time">
              <span className="skeleton mt-2 h-2.5 w-11 rounded-full" />
            </div>
            <span className="rail-node" aria-hidden>
              <span className="node" />
            </span>
            <div className="card-toned rail-card flex flex-col gap-2">
              <span className="skeleton h-3.5 w-36 rounded-full" />
              <span className="skeleton h-2.5 w-24 rounded-full" />
              <span className="skeleton h-2.5 w-full rounded-full" />
              <span className="skeleton h-9 w-full rounded-xl" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
