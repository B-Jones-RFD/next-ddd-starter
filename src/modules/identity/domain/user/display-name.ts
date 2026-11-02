import type { Brand } from '@/shared/kernel/brand'
import { ValidationError } from '@/shared/kernel/errors/domain-error'
import { err, ok, type Result } from '@/shared/kernel/result'

/** The name a user chooses to be shown to other people. */
export type DisplayName = Brand<string, 'DisplayName'>

export const DISPLAY_NAME_MAX_LENGTH = 50

/** Trims, then requires 1 to 50 characters. */
export function parseDisplayName(
  raw: string
): Result<DisplayName, ValidationError> {
  const value = raw.trim()
  if (value.length === 0) {
    return err(new ValidationError({ displayName: 'required' }))
  }
  if (value.length > DISPLAY_NAME_MAX_LENGTH) {
    return err(new ValidationError({ displayName: 'too-long' }))
  }
  return ok(value as DisplayName)
}
