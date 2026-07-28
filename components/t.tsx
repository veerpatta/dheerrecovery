import { STRINGS, type StringKey } from '@/lib/i18n'

/**
 * Renders both languages; CSS on <html data-lang> shows one.
 * Only UI chrome goes through here — clinical wording is never translated.
 */
export function T({ k }: { k: StringKey }) {
  const s = STRINGS[k]
  return (
    <>
      <span className="lang-en">{s.en}</span>
      <span className="lang-hi">{s.hi}</span>
    </>
  )
}
