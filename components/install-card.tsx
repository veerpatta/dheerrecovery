'use client'

import { useEffect, useState } from 'react'
import { isIOS, isStandalone } from '@/lib/push-client'

/**
 * The one-time iPhone step, shown only where it is actually needed.
 *
 * iOS allows web push solely for a page that has been added to the Home
 * Screen — in a Safari tab the `Notification` API is not even defined. So on
 * an iPhone there is no "enable alerts" button to offer yet; there is a
 * prerequisite, and saying that plainly is more useful than a button that
 * cannot work.
 *
 * Rendered client-side after mount because it depends on `navigator`, and the
 * server has no way to know whether this page is standalone.
 */
export function InstallCard() {
  const [needed, setNeeded] = useState(false)

  useEffect(() => {
    setNeeded(isIOS() && !isStandalone())
  }, [])

  if (!needed) return null

  return (
    <section className="card border-amber-line bg-amber-soft">
      <p className="eyebrow text-amber-ink">
        <span className="lang-en">iPhone · one-time setup</span>
        <span className="lang-hi">आईफ़ोन · एक बार का सेटअप</span>
      </p>
      <h2 className="mt-1 text-[15px] leading-snug font-extrabold text-navy">
        <span className="lang-en">Add this to the Home Screen to get alerts</span>
        <span className="lang-hi">सूचनाओं के लिए इसे होम स्क्रीन पर जोड़ें</span>
      </h2>
      <p className="mt-1.5 text-[12px] leading-relaxed text-amber-ink">
        <span className="lang-en">
          On an iPhone, alerts only work once this page is on the Home Screen.
          Tap <strong>Share</strong> (the square with the arrow), scroll to{' '}
          <strong>Add to Home Screen</strong>, then open Dheer Recovery from its
          icon and come back here.
        </span>
        <span className="lang-hi">
          आईफ़ोन पर सूचनाएँ तभी आती हैं जब यह पेज होम स्क्रीन पर हो।{' '}
          <strong>शेयर</strong> बटन (ऊपर तीर वाला चौकोर) दबाएँ,{' '}
          <strong>Add to Home Screen</strong> चुनें, फिर होम स्क्रीन आइकन से खोलकर
          यहाँ वापस आएँ।
        </span>
      </p>
    </section>
  )
}
