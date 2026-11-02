import type { Brand } from '@/shared/kernel/brand'

/** The one domain type every context shares: who a user is (§2). */
export type UserId = Brand<string, 'UserId'>

/** Marks a string as a user id. Use it where an id enters from outside. */
export function toUserId(value: string): UserId {
  return value as UserId
}
