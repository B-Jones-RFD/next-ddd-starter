import type { Brand } from '@/shared/kernel/brand'
import { ValidationError } from '@/shared/kernel/errors/domain-error'
import { err, ok, type Result } from '@/shared/kernel/result'

/** A password as typed. It is only ever hashed, never stored. */
export type Password = Brand<string, 'Password'>

export const PASSWORD_MIN_LENGTH = 8
export const PASSWORD_MAX_LENGTH = 128

/** Requires 8 to 128 characters. Not trimmed: every character counts. */
export function parsePassword(raw: string): Result<Password, ValidationError> {
  if (raw.length === 0) {
    return err(new ValidationError({ password: 'required' }))
  }
  if (raw.length < PASSWORD_MIN_LENGTH) {
    return err(new ValidationError({ password: 'too-short' }))
  }
  if (raw.length > PASSWORD_MAX_LENGTH) {
    return err(new ValidationError({ password: 'too-long' }))
  }
  return ok(raw as Password)
}
