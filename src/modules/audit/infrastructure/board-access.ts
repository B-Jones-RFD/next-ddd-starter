import type {
  BoardRole,
  IBoardAccess,
} from '@/modules/audit/application/ports/board-access.port'
import { roleOf, ValidationError } from '@/modules/boards/api'
import {
  InfrastructureError,
  PersistenceError,
} from '@/shared/kernel/errors/infrastructure-error'
import type { UserId } from '@/shared/kernel/user-id'

const PORT = 'IBoardAccess'

/**
 * Audit's anti-corruption layer over boards' `roleOf` query (§6). It
 * translates boards' answers into audit's terms, and its outages into this
 * port's own `PersistenceError`, so boards' classes never reach audit. It
 * has no IO of its own, so the same class serves both adapter modes: in mock
 * mode, boards' `api.ts` runs on boards' mocks.
 */
export class BoardAccess implements IBoardAccess {
  async roleOf(boardId: string, userId: UserId): Promise<BoardRole | null> {
    let found: Awaited<ReturnType<typeof roleOf>>
    try {
      found = await roleOf({ boardId, userId })
    } catch (error) {
      if (error instanceof InfrastructureError) {
        throw new PersistenceError(PORT, {
          retryable: error.retryable,
          cause: error,
        })
      }
      throw error
    }

    if (found.ok) return found.value
    // An id boards can't even read names no board the user is on.
    if (found.error instanceof ValidationError) return null
    return found.error satisfies never
  }
}
