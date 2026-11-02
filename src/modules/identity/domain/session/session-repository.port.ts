import type {
  Session,
  SessionId,
  TokenHash,
} from '@/modules/identity/domain/session/session'
import type { SessionEvent } from '@/modules/identity/domain/session/session.events'
import type {
  ConflictError,
  NotFoundError,
} from '@/shared/kernel/errors/app-error'
import type { EventOrigin } from '@/shared/kernel/events'
import type { Result } from '@/shared/kernel/result'
import type { UserId } from '@/shared/kernel/user-id'

/** Where sessions live. Throws `PersistenceError` on an outage. */
export interface ISessionRepository {
  findByTokenHash(tokenHash: TokenHash): Promise<Result<Session, NotFoundError>>
  /** Every session of the user, ended and expired ones included. */
  findByUserId(userId: UserId): Promise<Session[]>
  /** Writes the session and its events in one transaction. */
  save(
    session: Session,
    events: readonly SessionEvent[],
    origin: EventOrigin
  ): Promise<Result<Session, ConflictError>>
  // #region touch
  /**
   * Records when the session was last used, with no version change and no
   * events: the one write a query makes (§13). An unknown id changes nothing.
   */
  touch(id: SessionId, lastSeenAt: Date): Promise<void>
  // #endregion touch
}
