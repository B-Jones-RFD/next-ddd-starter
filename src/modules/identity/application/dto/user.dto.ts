import type { UserId } from '@/shared/kernel/user-id'

/** A registered user, as another context finds them by email. */
export type UserDto = {
  userId: UserId
  displayName: string
  email: string
}
