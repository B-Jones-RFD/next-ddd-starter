import type { ValidationError } from '@/shared/kernel/errors/domain-error'
import type { Result } from '@/shared/kernel/result'
import type { UserId } from '@/shared/kernel/user-id'

/** A registered user, as boards finds them to add to a board. */
export type DirectoryUser = {
  readonly userId: UserId
  readonly displayName: string
  readonly email: string
}

/**
 * Who is registered, asked of identity (§6). Throws `PersistenceError` on an
 * outage.
 */
export interface IUserDirectory {
  /**
   * The user registered with `email`, or null if nobody is.
   * `ValidationError` if `email` isn't an email address.
   */
  findByEmail(
    actorId: UserId,
    email: string
  ): Promise<Result<DirectoryUser | null, ValidationError>>
}
