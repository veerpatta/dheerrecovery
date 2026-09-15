import type { SosStatus, Tone } from './catalog'

/**
 * How each medicine category and SOS status is drawn.
 *
 * These maps used to be copy-pasted into four components, so a colour changed
 * in one place quietly disagreed with the others. Presentation lives here
 * rather than in catalog.ts, which stays clinical data.
 */

export interface ToneStyle {
  /** Tailwind background utility, for the category dot and the chart spine. */
  bar: string
  /** The same colour as a literal, for SVG fills that cannot take a class. */
  hex: string
  label: string
  labelHi: string
}

export const TONE: Record<Tone, ToneStyle> = {
  recovery: { bar: 'bg-teal', hex: '#29a997', label: 'Recovery', labelHi: 'रिकवरी' },
  seizure: { bar: 'bg-violet', hex: '#8069b0', label: 'Seizure', labelHi: 'दौरा' },
  bp: { bar: 'bg-blue', hex: '#507fc6', label: 'Heart / BP', labelHi: 'हृदय / BP' },
  comfort: { bar: 'bg-amber', hex: '#d7972c', label: 'Comfort', labelHi: 'आराम' },
  chemo: { bar: 'bg-plum', hex: '#8a4f7d', label: 'Chemotherapy', labelHi: 'कीमोथेरेपी' },
}

/** `medicines.tone` is a plain text column, so callers hand in `string`. */
export function toneOf(tone: string): ToneStyle {
  return TONE[tone as Tone] ?? TONE.recovery
}

export interface SosStyle {
  label: string
  className: string
}

export const SOS_STATUS: Record<SosStatus, SosStyle> = {
  current: { label: 'Current SOS', className: 'bg-coral text-white' },
  previous: { label: 'Confirm first', className: 'bg-amber/15 text-amber-ink' },
  supportive: { label: 'Supportive care', className: 'bg-mint text-teal' },
}

export function sosStyleOf(status: string | null): SosStyle | null {
  if (!status) return null
  return SOS_STATUS[status as SosStatus] ?? null
}
