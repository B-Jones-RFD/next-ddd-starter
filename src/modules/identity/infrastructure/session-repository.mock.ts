import { translateSessionEvents } from '@/modules/identity/application/contracts/translate'
import type {
  Session,
  TokenHash,
} from '@/modules/identity/domain/session/session'
import type { ISessionRepository } from '@/modules/identity/domain/session/session-repository.port'
import type { SessionEvent } from '@/modules/identity/domain/session/session.events'
import { mockStore } from '@/shared/infrastructure/mock-stores'
import { outboxEntries } from '@/shared/infrastructure/outbox/outbox-entries'
import { ConflictError, NotFoundError } from '@/shared/kernel/errors/app-error'
import type { EventOrigin } from '@/shared/kernel/events'
import type { IOutbox } from '@/shared/kernel/ports/outbox.port'
import { err, ok, type Result } from '@/shared/kernel/result'

/** In-memory twin of `SessionRepository`. */
export class MockSessionRepository implements ISessionRepository {
  constructor(private readonly outbox: IOutbox) {}

  private sessions(): Map<string, Session> {
    return mockStore('identity.sessions', () => new Map<string, Session>())
  }

  async findByTokenHash(
    tokenHash: TokenHash
  ): Promise<Result<Session, NotFoundError>> {
    const session = [...this.sessions().values()].find(
      (s) => s.tokenHash === tokenHash
    )
    return session
      ? ok(structuredClone(session))
      : err(new NotFoundError('Session', 'by-token'))
  }

  async save(
    session: Session,
    events: readonly SessionEvent[],
    origin: EventOrigin
  ): Promise<Result<Session, ConflictError>> {
    const sessions = this.sessions()
    const stored = sessions.get(session.id)
    const tokenTaken = [...sessions.values()].some(
      (other) =>
        other.tokenHash === session.tokenHash && other.id !== session.id
    )
    const fresh =
      session.version === 0 ? !stored : stored?.version === session.version
    if (!fresh || tokenTaken) {
      return err(new ConflictError('Session', session.id))
    }

    const saved = { ...session, version: session.version + 1 }
    sessions.set(session.id, structuredClone(saved))
    this.outbox.append(
      outboxEntries({
        aggregateId: session.id,
        aggregateVersion: saved.version,
        origin,
        domainEvents: events,
        integrationEvents: translateSessionEvents(events),
      })
    )
    return ok(saved)
  }
}
