import type { Brand } from '@/shared/kernel/brand'

/** Which comment. Crosses contexts only as a plain string (§2). */
export type CommentId = Brand<string, 'CommentId'>

/** Marks a string as a comment id. Use it where an id enters from outside. */
export function toCommentId(value: string): CommentId {
  return value as CommentId
}
