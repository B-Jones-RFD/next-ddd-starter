import type {
  Session,
  TokenHash,
} from '@/modules/identity/domain/session/session'
import type { SessionEvent } from '@/modules/identity/domain/session/session.events'
import type {
  ConflictError,
  NotFoundError,
} from '@/shared/kernel/errors/app-error'
import type { EventOrigin } from '@/shared/kernel/events'
import type { Result } from '@/shared/kernel/result'

/** Where sessions live. Throws `PersistenceError` on an outage. */
export interface ISessionRepository {
  findByTokenHash(tokenHash: TokenHash): Promise<Result<Session, NotFoundError>>
  /** Writes the session and its events in one transaction. */
  save(
    session: Session,
    events: readonly SessionEvent[],
    origin: EventOrigin
  ): Promise<Result<Session, ConflictError>>
}
