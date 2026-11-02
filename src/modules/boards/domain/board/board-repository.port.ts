import type { Board } from '@/modules/boards/domain/board/board'
import type { BoardId } from '@/modules/boards/domain/board/board-id'
import type { BoardEvent } from '@/modules/boards/domain/board/board.events'
import type {
  ConflictError,
  NotFoundError,
} from '@/shared/kernel/errors/app-error'
import type { EventOrigin } from '@/shared/kernel/events'
import type { Result } from '@/shared/kernel/result'

/** Where boards live, with their members. Throws `PersistenceError` on an outage. */
export interface IBoardRepository {
  findById(id: BoardId): Promise<Result<Board, NotFoundError>>
  /**
   * Writes the board and its members, its events as `domain` outbox rows and
   * their translations as `integration` rows, in one transaction. Returns the
   * saved board at its new version, or `ConflictError` if it changed since
   * loading.
   */
  save(
    board: Board,
    events: readonly BoardEvent[],
    origin: EventOrigin
  ): Promise<Result<Board, ConflictError>>
}
