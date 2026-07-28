/**
 * The care code is the only credential in this app: whoever holds the link
 * can read and write the family record. It is generated with crypto-grade
 * randomness and is long enough that guessing is not practical.
 */
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no I, O, 0, 1 — read aloud safely
const CODE_LENGTH = 20

export function generateCareCode(): string {
  const bytes = new Uint8Array(CODE_LENGTH)
  crypto.getRandomValues(bytes)
  let out = ''
  for (const b of bytes) out += ALPHABET[b % ALPHABET.length]
  return out
}

export function isValidCareCode(code: string): boolean {
  return /^[A-Z0-9]{16,40}$/.test(code)
}

/** Chunk into groups of 5 for reading over the phone. */
export function prettyCareCode(code: string): string {
  return (code.match(/.{1,5}/g) ?? [code]).join('-')
}
