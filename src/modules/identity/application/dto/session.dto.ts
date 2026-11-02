import type { UserId } from '@/shared/kernel/user-id'

/** A new session's raw cookie token. Only its hash is stored. */
export type SessionTokenDto = {
  token: string
}

/** Who a valid session belongs to (§9). Session ids never leave identity. */
export type ActorDto = {
  userId: UserId
  displayName: string
}
