import type { Brand } from '@/shared/kernel/brand'

/** Which board. Crosses contexts only as a plain string (§2). */
export type BoardId = Brand<string, 'BoardId'>

/** Marks a string as a board id. Use it where an id enters from outside. */
export function toBoardId(value: string): BoardId {
  return value as BoardId
}
