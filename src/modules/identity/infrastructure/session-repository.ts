import type { DatabaseSync } from 'node:sqlite'

import { translateSessionEvents } from '@/modules/identity/application/contracts/translate'
import type {
  Session,
  SessionId,
  TokenHash,
} from '@/modules/identity/domain/session/session'
import type { ISessionRepository } from '@/modules/identity/domain/session/session-repository.port'
import type { SessionEvent } from '@/modules/identity/domain/session/session.events'
import { outboxEntries } from '@/shared/infrastructure/outbox/outbox-entries'
import {
  ROLLBACK,
  transaction,
} from '@/shared/infrastructure/sqlite/transaction'
import { query } from '@/shared/infrastructure/sqlite/translate-error'
import { ConflictError, NotFoundError } from '@/shared/kernel/errors/app-error'
import type { EventOrigin } from '@/shared/kernel/events'
import type { IOutbox } from '@/shared/kernel/ports/outbox.port'
import { err, ok, type Result } from '@/shared/kernel/result'
import { toUserId } from '@/shared/kernel/user-id'

const PORT = 'ISessionRepository'

type Row = {
  id: string
  user_id: string
  token_hash: string
  created_at: string
  last_seen_at: string
  version: number
}

function toSession(row: Row): Session {
  return {
    id: row.id as SessionId,
    userId: toUserId(row.user_id),
    tokenHash: row.token_hash as TokenHash,
    createdAt: new Date(row.created_at),
    lastSeenAt: new Date(row.last_seen_at),
    version: row.version,
  }
}

/** Sessions in `identity_sessions`, keyed by token hash. */
export class SessionRepository implements ISessionRepository {
  constructor(
    private readonly db: DatabaseSync,
    private readonly outbox: IOutbox
  ) {}

  async findByTokenHash(
    tokenHash: TokenHash
  ): Promise<Result<Session, NotFoundError>> {
    const row = query(
      PORT,
      () =>
        this.db
          .prepare('SELECT * FROM identity_sessions WHERE token_hash = ?')
          .get(tokenHash) as Row | undefined
    )
    return row
      ? ok(toSession(row))
      : err(new NotFoundError('Session', 'by-token'))
  }

  async save(
    session: Session,
    events: readonly SessionEvent[],
    origin: EventOrigin
  ): Promise<Result<Session, ConflictError>> {
    const version = session.version + 1
    const entries = outboxEntries({
      aggregateId: session.id,
      aggregateVersion: version,
      origin,
      domainEvents: events,
      integrationEvents: translateSessionEvents(events),
    })

    const written = transaction(this.db, PORT, () => {
      const { changes } =
        session.version === 0
          ? this.db
              .prepare(
                `INSERT INTO identity_sessions
                   (id, user_id, token_hash, created_at, last_seen_at, version)
                 VALUES (?, ?, ?, ?, ?, 1)
                 ON CONFLICT DO NOTHING`
              )
              .run(
                session.id,
                session.userId,
                session.tokenHash,
                session.createdAt.toISOString(),
                session.lastSeenAt.toISOString()
              )
          : this.db
              .prepare(
                `UPDATE identity_sessions
                 SET last_seen_at = ?, version = version + 1
                 WHERE id = ? AND version = ?`
              )
              .run(
                session.lastSeenAt.toISOString(),
                session.id,
                session.version
              )
      if (changes === 0) return ROLLBACK
      this.outbox.append(entries)
      return true
    })

    if (written === ROLLBACK) {
      return err(new ConflictError('Session', session.id))
    }
    return ok({ ...session, version })
  }
}
