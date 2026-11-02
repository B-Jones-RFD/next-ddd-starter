import type {
  SessionEndReason,
  SessionEvent,
} from '@/modules/identity/domain/session/session.events'
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
  /** When a sign-out or password change ended it. Expiry never sets it. */
  readonly endedAt: Date | null
  /** Owned by persistence: 0 until first saved (§5). */
  readonly version: number
}

const MINUTE_MS = 60_000
const DAY_MS = 24 * 60 * MINUTE_MS

/** A session ends after 7 days without use (ADR 0009). */
export const SESSION_IDLE_LIMIT_MS = 7 * DAY_MS
/** …and 30 days after it started, however much it is used. */
export const SESSION_ABSOLUTE_LIMIT_MS = 30 * DAY_MS
/** `lastSeenAt` is written at most this often (§13). */
export const SESSION_TOUCH_INTERVAL_MS = MINUTE_MS

type Change = { state: Session; events: SessionEvent[] }

/** Starts a session for a user who just signed up or signed in. */
export function startSession(input: {
  id: SessionId
  userId: UserId
  tokenHash: TokenHash
  now: Date
}): Change {
  return {
    state: {
      id: input.id,
      userId: input.userId,
      tokenHash: input.tokenHash,
      createdAt: input.now,
      lastSeenAt: input.now,
      endedAt: null,
      version: 0,
    },
    events: [{ type: 'SessionStarted', payload: { userId: input.userId } }],
  }
}

/**
 * Whether the session still signs its user in: not ended, used within the
 * last 7 days, and started less than 30 days ago. Expiry is computed here,
 * on read, with no event.
 */
export function isSessionActive(session: Session, now: Date): boolean {
  const time = now.getTime()
  return (
    session.endedAt === null &&
    time - session.lastSeenAt.getTime() < SESSION_IDLE_LIMIT_MS &&
    time - session.createdAt.getTime() < SESSION_ABSOLUTE_LIMIT_MS
  )
}

/** Whether a use now should record `lastSeenAt`: at most once a minute. */
export function isTouchDue(session: Session, now: Date): boolean {
  return (
    now.getTime() - session.lastSeenAt.getTime() >= SESSION_TOUCH_INTERVAL_MS
  )
}

/** The session, seen now. No event: it is written straight through (§13). */
export function touchSession(session: Session, now: Date): Session {
  return { ...session, lastSeenAt: now }
}

/**
 * The user signs out of this session, on its own or as the one they signed
 * out everywhere from. A session already ended changes nothing.
 */
export function signOutSession(
  session: Session,
  input: { now: Date; everywhere: boolean }
): Change {
  if (session.endedAt !== null) return { state: session, events: [] }
  return {
    state: { ...session, endedAt: input.now },
    events: [
      {
        type: 'SessionSignedOut',
        payload: { userId: session.userId, everywhere: input.everywhere },
      },
    ],
  }
}

/**
 * Ends one of the user's other sessions, as a consequence of signing out
 * everywhere or changing their password. A session already ended changes
 * nothing.
 */
export function endSession(
  session: Session,
  input: { now: Date; reason: SessionEndReason }
): Change {
  if (session.endedAt !== null) return { state: session, events: [] }
  return {
    state: { ...session, endedAt: input.now },
    events: [
      {
        type: 'SessionEnded',
        payload: { userId: session.userId, reason: input.reason },
      },
    ],
  }
}
