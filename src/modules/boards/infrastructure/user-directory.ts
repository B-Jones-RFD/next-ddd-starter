import type {
  DirectoryUser,
  IUserDirectory,
} from '@/modules/boards/application/ports/user-directory.port'
import { findUserByEmail, NotFoundError } from '@/modules/identity/api'
import { ValidationError } from '@/shared/kernel/errors/domain-error'
import {
  InfrastructureError,
  PersistenceError,
} from '@/shared/kernel/errors/infrastructure-error'
import { err, ok, type Result } from '@/shared/kernel/result'
import type { UserId } from '@/shared/kernel/user-id'

const PORT = 'IUserDirectory'

/**
 * Boards' anti-corruption layer over identity's `findUserByEmail` (§6). It
 * translates identity's answers into boards' terms, and its outages into
 * this port's own `PersistenceError`, so identity's classes never reach
 * boards. It has no IO of its own, so the same class serves both adapter
 * modes: in mock mode, identity's `api.ts` runs on identity's mocks.
 */
export class UserDirectory implements IUserDirectory {
  async findByEmail(
    actorId: UserId,
    email: string
  ): Promise<Result<DirectoryUser | null, ValidationError>> {
    let found: Awaited<ReturnType<typeof findUserByEmail>>
    try {
      found = await findUserByEmail({ actorId, email })
    } catch (error) {
      if (error instanceof InfrastructureError) {
        throw new PersistenceError(PORT, {
          retryable: error.retryable,
          cause: error,
        })
      }
      throw error
    }

    if (found.ok) {
      const { userId, displayName, email: address } = found.value
      return ok({ userId, displayName, email: address })
    }
    if (found.error instanceof NotFoundError) return ok(null)
    if (found.error instanceof ValidationError) {
      return err(new ValidationError(found.error.fields))
    }
    return found.error satisfies never
  }
}
