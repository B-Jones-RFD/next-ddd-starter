import type { Brand } from '@/shared/kernel/brand'
import { ValidationError } from '@/shared/kernel/errors/domain-error'
import { err, ok, type Result } from '@/shared/kernel/result'

/** A user's email address, trimmed and lowercased so it compares exactly. */
export type Email = Brand<string, 'Email'>

export const EMAIL_MAX_LENGTH = 254

const SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Trims and lowercases, then requires an address of at most 254 characters. */
export function parseEmail(raw: string): Result<Email, ValidationError> {
  const value = raw.trim().toLowerCase()
  if (value.length === 0) {
    return err(new ValidationError({ email: 'required' }))
  }
  if (value.length > EMAIL_MAX_LENGTH) {
    return err(new ValidationError({ email: 'too-long' }))
  }
  if (!SHAPE.test(value)) {
    return err(new ValidationError({ email: 'invalid' }))
  }
  return ok(value as Email)
}
