import type { Brand } from '@/shared/kernel/brand'
import { ValidationError } from '@/shared/kernel/errors/domain-error'
import { err, ok, type Result } from '@/shared/kernel/result'

/** What a Board member wrote in a comment. */
export type CommentText = Brand<string, 'CommentText'>

export const COMMENT_TEXT_MAX_LENGTH = 2000

/** Trims, then requires 1 to 2000 characters. */
export function parseCommentText(
  raw: string
): Result<CommentText, ValidationError> {
  const value = raw.trim()
  if (value.length === 0) {
    return err(new ValidationError({ text: 'required' }))
  }
  if (value.length > COMMENT_TEXT_MAX_LENGTH) {
    return err(new ValidationError({ text: 'too-long' }))
  }
  return ok(value as CommentText)
}
