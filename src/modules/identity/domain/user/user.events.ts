import type { DomainEvent } from '@/shared/kernel/events'
import type { UserId } from '@/shared/kernel/user-id'

/** A new user registered. Translated to `identity.UserRegistered.v1`. */
export type UserRegistered = DomainEvent<
  'UserRegistered',
  { userId: UserId; displayName: string }
>

/** A user changed their display name. Translated to `identity.UserRenamed.v1`. */
export type UserRenamed = DomainEvent<
  'UserRenamed',
  { userId: UserId; from: string; to: string }
>

/**
 * A user changed their password. Translated to
 * `identity.UserPasswordChanged.v1`.
 */
export type UserPasswordChanged = DomainEvent<
  'UserPasswordChanged',
  { userId: UserId }
>

export type UserEvent = UserRegistered | UserRenamed | UserPasswordChanged
