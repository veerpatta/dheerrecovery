'use client'

import { setTherapyDay } from '@/lib/actions'
import { useAction } from './chrome'

/**
 * The one question the day has to answer before the schedule is knowable.
 *
 * Temozolomide is given only on a day radiotherapy actually happened, so until
 * somebody says, the capsule is not absent from the timeline — it is unknown.
 * Showing it optimistically would draw an amber overdue card for a dose that
 * may never have been due, which is the same mistake as reading a missing
 * entry as a missed dose. So the day asks, plainly, once.
 *
 * There is no optimistic state here on purpose. The answer reshapes the whole
 * schedule — the ring's denominator, which cards exist, the adherence figures
 * — and none of that can be recomputed on the client. The sync hairline in the
 * header is the honest signal that the write is in flight.
 */
export function TherapyPrompt({
  careDate,
  answer,
}: {
  careDate: string
  /** null when nobody has answered yet. */
  answer: boolean | null
}) {
  const { run, busy } = useAction()

  const set = (therapy: boolean | null) =>
    run(
      () => setTherapyDay({ careDate, therapy }),
      therapy === null
        ? 'Therapy answer cleared'
        : therapy
          ? 'Radiation therapy today ✓'
          : 'No radiation therapy today ✓',
    )

  if (answer !== null) {
    return (
      <section
        className="card flex items-center justify-between gap-3 py-2.5"
        data-therapy={answer ? 'yes' : 'no'}
      >
        <p className="min-w-0 text-[12.5px] leading-snug font-semibold text-ink">
          <span className="lang-en">Radiation therapy today</span>
          <span className="lang-hi">आज रेडियोथेरेपी</span>{' '}
          <span
            className={`pill ${answer ? 'bg-mint text-teal' : 'bg-line/60 text-muted'}`}
          >
            {answer ? (
              <>
                <span className="lang-en">Yes</span>
                <span className="lang-hi">हाँ</span>
              </>
            ) : (
              <>
                <span className="lang-en">No</span>
                <span className="lang-hi">नहीं</span>
              </>
            )}
          </span>
        </p>
        <button
          type="button"
          disabled={busy}
          onClick={() => set(answer ? false : true)}
          aria-label={
            answer
              ? 'Change to no radiation therapy today'
              : 'Change to radiation therapy today'
          }
          className="shrink-0 rounded-full border border-line px-3 py-1.5 text-[11.5px] font-bold text-teal transition active:scale-95 disabled:opacity-50"
        >
          <span className="lang-en" aria-hidden>
            Change
          </span>
          <span className="lang-hi" aria-hidden>
            बदलें
          </span>
        </button>
      </section>
    )
  }

  return (
    <section className="card border-amber-line bg-amber-soft">
      <p className="eyebrow text-amber-ink">
        <span className="lang-en">Today’s schedule needs this</span>
        <span className="lang-hi">आज के शेड्यूल के लिए ज़रूरी</span>
      </p>
      <h2 className="mt-1 text-[15.5px] leading-snug font-extrabold text-navy">
        <span className="lang-en">Is there radiation therapy today?</span>
        <span className="lang-hi">क्या आज रेडियोथेरेपी है?</span>
      </h2>
      <p className="mt-1 text-[11.5px] leading-relaxed text-amber-ink">
        <span className="lang-en">
          The Temozolomide capsule is given only on a therapy day, so it is not on
          the timeline until this is answered.
        </span>
        <span className="lang-hi">
          टेमोज़ोलोमाइड कैप्सूल केवल थेरेपी वाले दिन दिया जाता है, इसलिए उत्तर
          देने तक वह सूची में नहीं आएगा।
        </span>
      </p>

      {/* Equal width: this genuinely is a coin toss, unlike Taken / Skip. */}
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => set(true)}
          aria-label="Yes, there is radiation therapy today"
          className="h-12 flex-1 rounded-2xl bg-teal text-[15px] font-bold text-white transition active:scale-[0.97] disabled:opacity-60"
        >
          <span className="lang-en" aria-hidden>
            Yes, therapy today
          </span>
          <span className="lang-hi" aria-hidden>
            हाँ, आज थेरेपी
          </span>
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => set(false)}
          aria-label="No radiation therapy today"
          className="h-12 flex-1 rounded-2xl border-[1.5px] border-line bg-white text-[15px] font-bold text-ink transition active:scale-[0.97] disabled:opacity-60"
        >
          <span className="lang-en" aria-hidden>
            No therapy
          </span>
          <span className="lang-hi" aria-hidden>
            थेरेपी नहीं
          </span>
        </button>
      </div>
    </section>
  )
}
