import type { ActorDto } from '@/modules/identity/application/dto/session.dto'
import type { UserDto } from '@/modules/identity/application/dto/user.dto'
import type {
  SessionId,
  TokenHash,
} from '@/modules/identity/domain/session/session'
import type { NotFoundError } from '@/shared/kernel/errors/app-error'
import type { ForbiddenError } from '@/shared/kernel/errors/domain-error'
import type { Result } from '@/shared/kernel/result'
import type { UserId } from '@/shared/kernel/user-id'

/** The user an active session signs in, and that session, inside identity. */
export type SignedIn = {
  readonly actor: ActorDto
  readonly sessionId: SessionId
  /** ISO time the session was last used. */
  readonly lastSeenAt: string
}

/**
 * What identity's queries read (§4): DTOs straight from storage, never
 * aggregates. Throws `PersistenceError` on an outage.
 */
export interface IUserReader {
  /**
   * Who the session with this token hash signs in, if it is still active at
   * `now`: not ended, used less than `SESSION_IDLE_LIMIT_MS` ago and started
   * less than `SESSION_ABSOLUTE_LIMIT_MS` ago. Null otherwise.
   */
  findSignedIn(tokenHash: TokenHash, now: Date): Promise<SignedIn | null>
  /**
   * The user registered with `email` (as stored: trimmed and lowercased), as
   * `actorId` may see them. `ForbiddenError` if the actor isn't a
   * registered user, `NotFoundError` if nobody registered the email.
   */
  findByEmail(
    actorId: UserId,
    email: string
  ): Promise<Result<UserDto, ForbiddenError | NotFoundError>>
}
