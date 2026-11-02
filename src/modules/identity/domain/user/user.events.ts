import type { DomainEvent } from '@/shared/kernel/events'
import type { UserId } from '@/shared/kernel/user-id'

/** A new user registered. Translated to `identity.UserRegistered.v1`. */
export type UserRegistered = DomainEvent<
  'UserRegistered',
  { userId: UserId; displayName: string }
>

export type UserEvent = UserRegistered
