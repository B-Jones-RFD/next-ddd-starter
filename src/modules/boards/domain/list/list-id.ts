import type { Brand } from '@/shared/kernel/brand'

/** Which list. Crosses contexts only as a plain string (§2). */
export type ListId = Brand<string, 'ListId'>

/** Marks a string as a list id. Use it where an id enters from outside. */
export function toListId(value: string): ListId {
  return value as ListId
}
