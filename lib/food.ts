/**
 * The catalogue's `food` field is a careful clinical paragraph — it has to be,
 * because most of these entries hedge ("as directed", "not printed", "confirm
 * with the pharmacist"). The full text still belongs on the card, but a
 * caregiver scanning the timeline at 8am needs the four-word version first.
 *
 * This condenses the paragraph to a chip label without ever inventing an
 * instruction the paragraph does not contain: anything unrecognised falls back
 * to "Food timing not printed", and any hedged source is flagged `unsure` so
 * the chip can say "check the strip" rather than sounding definitive.
 */
export interface FoodRule {
  label: string
  labelHi: string
  /** The source text hedges, so the chip must not read as an instruction. */
  unsure: boolean
}

/**
 * Ordered: the first match wins. "with or without food" is tested before the
 * bare "with food" so a permissive note is never narrowed into a requirement.
 */
const RULES: { test: RegExp; label: string; labelHi: string }[] = [
  {
    test: /not food-?related/i,
    label: 'Not food-related',
    labelHi: 'भोजन से संबंधित नहीं',
  },
  { test: /empty stomach/i, label: 'Empty stomach', labelHi: 'खाली पेट' },
  {
    test: /before (food|meals|breakfast)/i,
    label: 'Before food',
    labelHi: 'भोजन से पहले',
  },
  { test: /after (food|meals)/i, label: 'After food', labelHi: 'भोजन के बाद' },
  {
    test: /with or without food/i,
    label: 'With or without food',
    labelHi: 'भोजन के साथ या बिना',
  },
  { test: /with (food|meals)/i, label: 'With food', labelHi: 'भोजन के साथ' },
  { test: /small frequent sips|sips/i, label: 'Small sips', labelHi: 'थोड़े-थोड़े घूँट' },
]

const HEDGED = /confirm|not printed|as directed|not specified|was not printed/i

export function foodRuleOf(food: string | null | undefined): FoodRule | null {
  if (!food?.trim()) return null
  const unsure = HEDGED.test(food)
  const match = RULES.find((r) => r.test.test(food))
  if (match) return { label: match.label, labelHi: match.labelHi, unsure }
  return {
    label: 'Food timing not printed',
    labelHi: 'भोजन समय दर्ज नहीं',
    unsure: true,
  }
}
