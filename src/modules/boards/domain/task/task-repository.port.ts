import type { BoardId } from '@/modules/boards/domain/board/board-id'
import type { ListId } from '@/modules/boards/domain/list/list-id'
import type { Task } from '@/modules/boards/domain/task/task'
import type { TaskId } from '@/modules/boards/domain/task/task-id'
import type { TaskEvent } from '@/modules/boards/domain/task/task.events'
import type {
  ConflictError,
  NotFoundError,
} from '@/shared/kernel/errors/app-error'
import type { EventOrigin } from '@/shared/kernel/events'
import type { Result } from '@/shared/kernel/result'
import type { UserId } from '@/shared/kernel/user-id'

/** Where tasks live. Throws `PersistenceError` on an outage. */
export interface ITaskRepository {
  findById(id: TaskId): Promise<Result<Task, NotFoundError>>
  /**
   * The list's last task by `(position, id)`, archived ones included, or
   * null if it has none. A new task goes after it.
   */
  findLastInList(listId: ListId): Promise<Task | null>
  /**
   * The board's tasks that `userId` is an assignee of, archived ones
   * included, by id.
   */
  findAssignedTo(boardId: BoardId, userId: UserId): Promise<Task[]>
  /**
   * Writes the task, its events as `domain` outbox rows and their
   * translations as `integration` rows, in one transaction. Returns the
   * saved task at its new version, or `ConflictError` if it changed since
   * loading.
   */
  save(
    task: Task,
    events: readonly TaskEvent[],
    origin: EventOrigin
  ): Promise<Result<Task, ConflictError>>
}
