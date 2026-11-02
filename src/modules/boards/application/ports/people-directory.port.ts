import type {
  ForbiddenError,
  ValidationError,
} from '@/shared/kernel/errors/domain-error'
import type { Result } from '@/shared/kernel/result'
import type { UserId } from '@/shared/kernel/user-id'

/** A Person with an account, as boards finds them to add to a board. */
export type DirectoryPerson = {
  readonly userId: UserId
  readonly displayName: string
  readonly email: string
}

/**
 * Who has an account, asked of identity (§6). Throws `PersistenceError` on an
 * outage.
 */
export interface IPeopleDirectory {
  /**
   * The Person registered with `email`, or null if nobody is, as `actorId`
   * may see them. `ValidationError` if `email` isn't an email address, and
   * `ForbiddenError` if the actor has no account.
   */
  findByEmail(
    actorId: UserId,
    email: string
  ): Promise<Result<DirectoryPerson | null, ValidationError | ForbiddenError>>
}
