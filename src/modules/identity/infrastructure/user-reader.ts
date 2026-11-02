import type { DatabaseSync } from 'node:sqlite'

import type { UserDto } from '@/modules/identity/application/dto/user.dto'
import type {
  IUserReader,
  SignedIn,
} from '@/modules/identity/application/ports/user-reader.port'
import {
  SESSION_ABSOLUTE_LIMIT_MS,
  SESSION_IDLE_LIMIT_MS,
  type SessionId,
  type TokenHash,
} from '@/modules/identity/domain/session/session'
import { query } from '@/shared/infrastructure/sqlite/translate-error'
import { NotFoundError } from '@/shared/kernel/errors/app-error'
import { ForbiddenError } from '@/shared/kernel/errors/domain-error'
import { err, ok, type Result } from '@/shared/kernel/result'
import { toUserId, type UserId } from '@/shared/kernel/user-id'

const PORT = 'IUserReader'

type SignedInRow = {
  session_id: string
  last_seen_at: string
  user_id: string
  display_name: string
}

type ByEmailRow = {
  known: number
  id: string | null
  display_name: string | null
  email: string | null
}

/** Identity's reads, straight from `identity_users` and `identity_sessions`. */
export class UserReader implements IUserReader {
  constructor(private readonly db: DatabaseSync) {}

  async findSignedIn(
    tokenHash: TokenHash,
    now: Date
  ): Promise<SignedIn | null> {
    const time = now.getTime()
    // Times are stored as ISO strings in UTC, so they compare as text.
    const row = query(
      PORT,
      () =>
        this.db
          .prepare(
            `SELECT s.id AS session_id, s.last_seen_at, u.id AS user_id,
                    u.display_name
               FROM identity_sessions s
               JOIN identity_users u ON u.id = s.user_id
              WHERE s.token_hash = ?
                AND s.ended_at IS NULL
                AND s.last_seen_at > ?
                AND s.created_at > ?`
          )
          .get(
            tokenHash,
            new Date(time - SESSION_IDLE_LIMIT_MS).toISOString(),
            new Date(time - SESSION_ABSOLUTE_LIMIT_MS).toISOString()
          ) as SignedInRow | undefined
    )
    if (!row) return null
    return {
      actor: { userId: toUserId(row.user_id), displayName: row.display_name },
      sessionId: row.session_id as SessionId,
      lastSeenAt: row.last_seen_at,
    }
  }

  async findByEmail(
    actorId: UserId,
    email: string
  ): Promise<Result<UserDto, ForbiddenError | NotFoundError>> {
    // One read: whether the actor is a registered user, and the match.
    const row = query(
      PORT,
      () =>
        this.db
          .prepare(
            `SELECT EXISTS (SELECT 1 FROM identity_users WHERE id = ?) AS known,
                    u.id, u.display_name, u.email
               FROM (SELECT 1)
               LEFT JOIN identity_users u ON u.email = ?`
          )
          .get(actorId, email) as ByEmailRow
    )
    if (!row.known) return err(new ForbiddenError())
    if (row.id === null || row.display_name === null || row.email === null) {
      return err(new NotFoundError('User', 'by-email'))
    }
    return ok({
      userId: toUserId(row.id),
      displayName: row.display_name,
      email: row.email,
    })
  }
}
