import type { BoardId } from '@/modules/boards/domain/board/board-id'
import type { List } from '@/modules/boards/domain/list/list'
import type { ListId } from '@/modules/boards/domain/list/list-id'
import type { ListEvent } from '@/modules/boards/domain/list/list.events'
import type {
  ConflictError,
  NotFoundError,
} from '@/shared/kernel/errors/app-error'
import type { EventOrigin } from '@/shared/kernel/events'
import type { Result } from '@/shared/kernel/result'

/** Where lists live. Throws `PersistenceError` on an outage. */
export interface IListRepository {
  findById(id: ListId): Promise<Result<List, NotFoundError>>
  /**
   * The board's last list by `(position, id)`, archived ones included, or
   * null if it has none. A new list goes after it.
   */
  findLastOnBoard(boardId: BoardId): Promise<List | null>
  /**
   * Writes the list, its events as `domain` outbox rows and their
   * translations as `integration` rows, in one transaction. Returns the
   * saved list at its new version, or `ConflictError` if it changed since
   * loading.
   */
  save(
    list: List,
    events: readonly ListEvent[],
    origin: EventOrigin
  ): Promise<Result<List, ConflictError>>
}
