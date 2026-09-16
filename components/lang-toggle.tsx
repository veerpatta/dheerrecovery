'use client'

import { useEffect, useState } from 'react'

const KEY = 'dheer-lang'

export function LangToggle() {
  const [lang, setLang] = useState<'en' | 'hi'>('en')

  useEffect(() => {
    const saved = (localStorage.getItem(KEY) as 'en' | 'hi' | null) ?? 'en'
    setLang(saved)
    document.documentElement.dataset.lang = saved
  }, [])

  function toggle() {
    const next = lang === 'en' ? 'hi' : 'en'
    setLang(next)
    localStorage.setItem(KEY, next)
    document.documentElement.dataset.lang = next
    /*
     * A service worker cannot read localStorage, so a subscribed device only
     * knows which language to speak from the `lang` stored on its row. PushSync
     * listens for this and updates it; without the event, notifications would
     * keep arriving in the language the phone was subscribed in.
     */
    window.dispatchEvent(new Event('dheer-lang-change'))
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className="shrink-0 rounded-full border border-line bg-white px-2.5 py-1.5 text-[11px] font-bold text-ink transition active:scale-95"
      aria-label={lang === 'en' ? 'हिंदी में देखें' : 'View in English'}
    >
      {/*
        Both labels are rendered and CSS picks one, so the button does not
        flip a frame after hydration on a Hindi caregiver's phone.
      */}
      <span className="lang-en" aria-hidden>
        हिं
      </span>
      <span className="lang-hi" aria-hidden>
        EN
      </span>
    </button>
  )
}
