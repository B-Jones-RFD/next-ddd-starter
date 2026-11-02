import type { Email } from '@/modules/identity/domain/user/email'
import type { User } from '@/modules/identity/domain/user/user'
import type { UserEvent } from '@/modules/identity/domain/user/user.events'
import type {
  ConflictError,
  NotFoundError,
} from '@/shared/kernel/errors/app-error'
import type { EventOrigin } from '@/shared/kernel/events'
import type { Result } from '@/shared/kernel/result'
import type { UserId } from '@/shared/kernel/user-id'

/** Where users live. Throws `PersistenceError` on an outage. */
export interface IUserRepository {
  findById(id: UserId): Promise<Result<User, NotFoundError>>
  findByEmail(email: Email): Promise<Result<User, NotFoundError>>
  /**
   * Writes the user, its events as `domain` outbox rows and their
   * translations as `integration` rows, in one transaction. Returns the saved
   * user at its new version, or `ConflictError` if it changed since loading.
   */
  save(
    user: User,
    events: readonly UserEvent[],
    origin: EventOrigin
  ): Promise<Result<User, ConflictError>>
}
