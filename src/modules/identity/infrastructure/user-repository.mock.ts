import { translateUserEvents } from '@/modules/identity/application/contracts/translate'
import type { Email } from '@/modules/identity/domain/user/email'
import type { User } from '@/modules/identity/domain/user/user'
import type { IUserRepository } from '@/modules/identity/domain/user/user-repository.port'
import type { UserEvent } from '@/modules/identity/domain/user/user.events'
import { mockStore } from '@/shared/infrastructure/mock-stores'
import { outboxEntries } from '@/shared/infrastructure/outbox/outbox-entries'
import { ConflictError, NotFoundError } from '@/shared/kernel/errors/app-error'
import type { EventOrigin } from '@/shared/kernel/events'
import type { IOutbox } from '@/shared/kernel/ports/outbox.port'
import { err, ok, type Result } from '@/shared/kernel/result'
import type { UserId } from '@/shared/kernel/user-id'

/** In-memory twin of `UserRepository`: same version and uniqueness rules. */
export class MockUserRepository implements IUserRepository {
  constructor(private readonly outbox: IOutbox) {}

  private users(): Map<string, User> {
    return mockStore('identity.users', () => new Map<string, User>())
  }

  async findById(id: UserId): Promise<Result<User, NotFoundError>> {
    const user = this.users().get(id)
    return user ? ok(structuredClone(user)) : err(new NotFoundError('User', id))
  }

  async findByEmail(email: Email): Promise<Result<User, NotFoundError>> {
    const user = [...this.users().values()].find((u) => u.email === email)
    return user
      ? ok(structuredClone(user))
      : err(new NotFoundError('User', 'by-email'))
  }

  // #region save
  async save(
    user: User,
    events: readonly UserEvent[],
    origin: EventOrigin
  ): Promise<Result<User, ConflictError>> {
    const users = this.users()
    const stored = users.get(user.id)
    const emailTaken = [...users.values()].some(
      (other) => other.email === user.email && other.id !== user.id
    )
    const fresh =
      user.version === 0 ? !stored : stored?.version === user.version
    if (!fresh || emailTaken) return err(new ConflictError('User', user.id))

    const saved = { ...user, version: user.version + 1 }
    users.set(user.id, structuredClone(saved))
    this.outbox.append(
      outboxEntries({
        aggregateId: user.id,
        aggregateVersion: saved.version,
        origin,
        domainEvents: events,
        integrationEvents: translateUserEvents(events),
      })
    )
    return ok(saved)
  }
  // #endregion save
}
