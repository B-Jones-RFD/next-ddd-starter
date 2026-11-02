import type { TagColor } from '@/modules/boards/domain/board/tag-color'
import type { TagName } from '@/modules/boards/domain/board/tag-name'
import type { Brand } from '@/shared/kernel/brand'

/** Which tag. Crosses contexts only as a plain string (§2). */
export type TagId = Brand<string, 'TagId'>

/** Marks a string as a tag id. Use it where an id enters from outside. */
export function toTagId(value: string): TagId {
  return value as TagId
}

/**
 * A label defined on one board, which its Board members attach to that
 * board's tasks. It lives on the Board aggregate.
 */
export type Tag = {
  readonly id: TagId
  readonly name: TagName
  readonly color: TagColor
}
