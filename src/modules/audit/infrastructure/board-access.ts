import type {
  BoardRole,
  IBoardAccess,
} from '@/modules/audit/application/ports/board-access.port'
import { roleOf, ValidationError } from '@/modules/boards/api'
import { askContext } from '@/shared/infrastructure/ask-context'
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
  async roleOf(boardId: string, actorId: UserId): Promise<BoardRole | null> {
    const found = await askContext(PORT, () => roleOf({ actorId, boardId }))
    if (found.ok) return found.value
    // An id boards can't even read names no board the actor is on.
    if (found.error instanceof ValidationError) return null
    return found.error satisfies never
  }
}
