import type { BoardSummaryDto } from '@/modules/boards/application/dto/board-summary.dto'
import type { BoardDto } from '@/modules/boards/application/dto/board.dto'
import type { TagDto } from '@/modules/boards/application/dto/tag.dto'
import type { TaskDto } from '@/modules/boards/application/dto/task.dto'
import type { NotFoundError } from '@/shared/kernel/errors/app-error'
import type { ForbiddenError } from '@/shared/kernel/errors/domain-error'
import type { Result } from '@/shared/kernel/result'
import type { UserId } from '@/shared/kernel/user-id'

/**
 * Boards as their Board members read them. Every read joins on the reader's
 * membership, so nothing else authorizes a query (§4). Display names come
 * from `boards_people`. Throws `PersistenceError` on an outage.
 */
export interface IBoardReader {
  /** The boards `userId` is a Board member of, by name. */
  listForMember(userId: UserId): Promise<BoardSummaryDto[]>
  /**
   * The board with its active lists by `(position, id)`, each with its
   * active tasks by `(position, id)`, if `userId` is a Board member of it.
   * `NotFoundError` if there is no such board, and `ForbiddenError` if they
   * aren't a Board member.
   */
  getForMember(
    boardId: string,
    userId: UserId
  ): Promise<Result<BoardDto, NotFoundError | ForbiddenError>>
  /**
   * The task with its board's and list's names, if `userId` is a Board member
   * of its board. `NotFoundError` if there is no such task, and
   * `ForbiddenError` if they aren't a Board member.
   */
  getTaskForMember(
    taskId: string,
    userId: UserId
  ): Promise<Result<TaskDto, NotFoundError | ForbiddenError>>
  /**
   * The board's tags by name, ignoring case, if `userId` is a Board member of
   * it. `NotFoundError` if there is no such board, and `ForbiddenError` if
   * they aren't a Board member.
   */
  tagsForMember(
    boardId: string,
    userId: UserId
  ): Promise<Result<TagDto[], NotFoundError | ForbiddenError>>
  /** `userId`'s role on the board, or null if they aren't a Board member of it. */
  roleOf(boardId: string, userId: UserId): Promise<'owner' | 'member' | null>
}
