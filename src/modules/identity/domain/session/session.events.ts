import type { DomainEvent } from '@/shared/kernel/events'
import type { UserId } from '@/shared/kernel/user-id'

/**
 * A user started a session, by signing up or signing in. Translated to
 * `identity.UserSignedIn.v1`.
 */
export type SessionStarted = DomainEvent<'SessionStarted', { userId: UserId }>

/**
 * A user signed out of this session, on its own or everywhere. Translated to
 * `identity.UserSignedOut.v1`.
 */
export type SessionSignedOut = DomainEvent<
  'SessionSignedOut',
  { userId: UserId; everywhere: boolean }
>

/** Why one of a user's other sessions ended. */
export type SessionEndReason = 'signed-out-everywhere' | 'password-changed'

/**
 * One of the user's other sessions ended as a consequence. Not published:
 * the sign-out or password change it follows from is.
 */
export type SessionEnded = DomainEvent<
  'SessionEnded',
  { userId: UserId; reason: SessionEndReason }
>

export type SessionEvent = SessionStarted | SessionSignedOut | SessionEnded
