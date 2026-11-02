import type { DatabaseSync } from 'node:sqlite'

import { translateUserEvents } from '@/modules/identity/application/contracts/translate'
import type { DisplayName } from '@/modules/identity/domain/user/display-name'
import type { Email } from '@/modules/identity/domain/user/email'
import type { PasswordHash } from '@/modules/identity/domain/user/password-hash'
import type { User } from '@/modules/identity/domain/user/user'
import type { IUserRepository } from '@/modules/identity/domain/user/user-repository.port'
import type { UserEvent } from '@/modules/identity/domain/user/user.events'
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
import { toUserId, type UserId } from '@/shared/kernel/user-id'

const PORT = 'IUserRepository'

type Row = {
  id: string
  display_name: string
  email: string
  password_hash: string
  created_at: string
  version: number
}

function toUser(row: Row): User {
  return {
    id: toUserId(row.id),
    displayName: row.display_name as DisplayName,
    email: row.email as Email,
    passwordHash: row.password_hash as PasswordHash,
    createdAt: new Date(row.created_at),
    version: row.version,
  }
}

/** Users in `identity_users`. */
export class UserRepository implements IUserRepository {
  constructor(
    private readonly db: DatabaseSync,
    private readonly outbox: IOutbox
  ) {}

  async findById(id: UserId): Promise<Result<User, NotFoundError>> {
    const row = query(
      PORT,
      () =>
        this.db.prepare('SELECT * FROM identity_users WHERE id = ?').get(id) as
          Row | undefined
    )
    return row ? ok(toUser(row)) : err(new NotFoundError('User', id))
  }

  async findByEmail(email: Email): Promise<Result<User, NotFoundError>> {
    const row = query(
      PORT,
      () =>
        this.db
          .prepare('SELECT * FROM identity_users WHERE email = ?')
          .get(email) as Row | undefined
    )
    return row ? ok(toUser(row)) : err(new NotFoundError('User', 'by-email'))
  }

  // #region save
  async save(
    user: User,
    events: readonly UserEvent[],
    origin: EventOrigin
  ): Promise<Result<User, ConflictError>> {
    const version = user.version + 1
    const entries = outboxEntries({
      aggregateId: user.id,
      aggregateVersion: version,
      origin,
      domainEvents: events,
      integrationEvents: translateUserEvents(events),
    })

    const written = transaction(this.db, PORT, () => {
      const { changes } =
        user.version === 0
          ? this.db
              .prepare(
                `INSERT INTO identity_users
                   (id, display_name, email, password_hash, created_at, version)
                 VALUES (?, ?, ?, ?, ?, 1)
                 ON CONFLICT DO NOTHING`
              )
              .run(
                user.id,
                user.displayName,
                user.email,
                user.passwordHash,
                user.createdAt.toISOString()
              )
          : this.db
              .prepare(
                `UPDATE identity_users
                 SET display_name = ?, email = ?, password_hash = ?,
                     version = version + 1
                 WHERE id = ? AND version = ?`
              )
              .run(
                user.displayName,
                user.email,
                user.passwordHash,
                user.id,
                user.version
              )
      if (changes === 0) return ROLLBACK
      this.outbox.append(entries)
      return true
    })

    if (written === ROLLBACK) return err(new ConflictError('User', user.id))
    return ok({ ...user, version })
  }
  // #endregion save
}
