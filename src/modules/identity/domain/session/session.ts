import type { SessionEvent } from '@/modules/identity/domain/session/session.events'
import type { Brand } from '@/shared/kernel/brand'
import type { UserId } from '@/shared/kernel/user-id'

/** Identifies a session inside identity. It never leaves the context (§9). */
export type SessionId = Brand<string, 'SessionId'>

/** The SHA-256 of a session's cookie token. The token itself is never stored. */
export type TokenHash = Brand<string, 'TokenHash'>

/** One signed-in stretch of a user on one browser. */
export type Session = {
  readonly id: SessionId
  readonly userId: UserId
  readonly tokenHash: TokenHash
  readonly createdAt: Date
  readonly lastSeenAt: Date
  /** Owned by persistence: 0 until first saved (§5). */
  readonly version: number
}

/** Starts a session for a user who just signed up or signed in. */
export function startSession(input: {
  id: SessionId
  userId: UserId
  tokenHash: TokenHash
  now: Date
}): { state: Session; events: SessionEvent[] } {
  return {
    state: {
      id: input.id,
      userId: input.userId,
      tokenHash: input.tokenHash,
      createdAt: input.now,
      lastSeenAt: input.now,
      version: 0,
    },
    events: [{ type: 'SessionStarted', payload: { userId: input.userId } }],
  }
}
