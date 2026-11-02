import type { Brand } from '@/shared/kernel/brand'
import { ValidationError } from '@/shared/kernel/errors/domain-error'
import { err, ok, type Result } from '@/shared/kernel/result'

/** What a tag is called. Unique on its board, ignoring case. */
export type TagName = Brand<string, 'TagName'>

export const TAG_NAME_MAX_LENGTH = 60

/** Trims, then requires 1 to 60 characters. */
export function parseTagName(raw: string): Result<TagName, ValidationError> {
  const value = raw.trim()
  if (value.length === 0) {
    return err(new ValidationError({ name: 'required' }))
  }
  if (value.length > TAG_NAME_MAX_LENGTH) {
    return err(new ValidationError({ name: 'too-long' }))
  }
  return ok(value as TagName)
}
