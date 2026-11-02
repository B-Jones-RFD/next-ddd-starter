import { randomBytes } from 'node:crypto'

let lastMs = 0
let counter = 0

/**
 * A UUID v7 (RFC 9562): a 48-bit millisecond timestamp, then a 12-bit counter
 * that keeps ids made in the same millisecond in order, then random bits.
 */
export function uuidv7(): string {
  let ms = Date.now()
  if (ms <= lastMs) {
    counter += 1
    if (counter > 0xfff) {
      lastMs += 1
      counter = 0
    }
    ms = lastMs
  } else {
    lastMs = ms
    counter = 0
  }

  const bytes = randomBytes(16)
  bytes.writeUIntBE(ms, 0, 6)
  bytes[6] = 0x70 | (counter >> 8)
  bytes[7] = counter & 0xff
  bytes[8] = 0x80 | ((bytes[8] ?? 0) & 0x3f)

  const hex = bytes.toString('hex')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}
