import type { Brand } from '@/shared/kernel/brand'
import { ValidationError } from '@/shared/kernel/errors/domain-error'
import { err, ok, type Result } from '@/shared/kernel/result'

/** What a board is called. */
export type BoardName = Brand<string, 'BoardName'>

export const BOARD_NAME_MAX_LENGTH = 60

/** Trims, then requires 1 to 60 characters. */
export function parseBoardName(
  raw: string
): Result<BoardName, ValidationError> {
  const value = raw.trim()
  if (value.length === 0) {
    return err(new ValidationError({ name: 'required' }))
  }
  if (value.length > BOARD_NAME_MAX_LENGTH) {
    return err(new ValidationError({ name: 'too-long' }))
  }
  return ok(value as BoardName)
}
