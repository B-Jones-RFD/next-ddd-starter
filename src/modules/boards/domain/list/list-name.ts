import type { Brand } from '@/shared/kernel/brand'
import { ValidationError } from '@/shared/kernel/errors/domain-error'
import { err, ok, type Result } from '@/shared/kernel/result'

/** What a list is called. */
export type ListName = Brand<string, 'ListName'>

export const LIST_NAME_MAX_LENGTH = 60

/** Trims, then requires 1 to 60 characters. */
export function parseListName(raw: string): Result<ListName, ValidationError> {
  const value = raw.trim()
  if (value.length === 0) {
    return err(new ValidationError({ name: 'required' }))
  }
  if (value.length > LIST_NAME_MAX_LENGTH) {
    return err(new ValidationError({ name: 'too-long' }))
  }
  return ok(value as ListName)
}
