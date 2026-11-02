// Fractional keys for user-sorted items (§3). A key is a base-62 fraction
// whose digits sort in ASCII order, so plain string comparison (JavaScript's
// `<` and SQLite's default BINARY collation) orders keys by value. A key never
// ends in the zero digit, which keeps a key between any two keys possible.

const DIGITS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'
const ZERO = '0'
const VALID_KEY = /^[0-9A-Za-z]*[1-9A-Za-z]$/

function digit(char: string | undefined): number {
  return char === undefined ? 0 : DIGITS.indexOf(char)
}

// The fraction halfway between `low` and `high` (null means 1), as digits.
// `low` may be '' (meaning 0).
function midpoint(low: string, high: string | null): string {
  if (high !== null) {
    // Skip the digits the two share, treating a missing digit of `low` as 0.
    let shared = 0
    while ((low[shared] ?? ZERO) === high[shared]) shared += 1
    if (shared > 0) {
      return (
        high.slice(0, shared) + midpoint(low.slice(shared), high.slice(shared))
      )
    }
  }
  const lowDigit = digit(low[0])
  const highDigit = high === null ? DIGITS.length : digit(high[0])
  if (highDigit - lowDigit > 1) {
    return DIGITS[Math.round((lowDigit + highDigit) / 2)] as string
  }
  // Adjacent first digits: take `high`'s first digit if more follows it,
  // otherwise keep `low`'s first digit and split what comes after it.
  if (high !== null && high.length > 1) return high.slice(0, 1)
  return (DIGITS[lowDigit] as string) + midpoint(low.slice(1), null)
}

/**
 * A key that sorts strictly between `a` and `b`, where null means "no item
 * on that side". `keyBetween(null, null)` starts an empty order. Throws if
 * either key is malformed or `a` doesn't sort before `b`: callers check order
 * before asking.
 */
export function keyBetween(a: string | null, b: string | null): string {
  for (const key of [a, b]) {
    if (key !== null && !VALID_KEY.test(key)) {
      throw new Error('keyBetween: malformed key')
    }
  }
  if (a !== null && b !== null && a >= b) {
    throw new Error('keyBetween: keys out of order')
  }
  return midpoint(a ?? '', b)
}
