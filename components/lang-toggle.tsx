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
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className="rounded-full border border-line bg-white px-3 py-1.5 text-xs font-semibold text-ink"
      aria-label={lang === 'en' ? 'हिंदी में देखें' : 'View in English'}
    >
      {lang === 'en' ? 'हिंदी' : 'English'}
    </button>
  )
}
