import type { BoardId } from '@/modules/boards/domain/board/board-id'
import type { ListId } from '@/modules/boards/domain/list/list-id'
import type { TaskId } from '@/modules/boards/domain/task/task-id'
import type { DomainEvent } from '@/shared/kernel/events'
import type { UserId } from '@/shared/kernel/user-id'

/** A Board member added a task to a list. Translated to `boards.TaskCreated.v1`. */
export type TaskCreated = DomainEvent<
  'TaskCreated',
  { taskId: TaskId; boardId: BoardId; listId: ListId; title: string }
>

/** A Board member renamed a task. Translated to `boards.TaskRenamed.v1`. */
export type TaskRenamed = DomainEvent<
  'TaskRenamed',
  { taskId: TaskId; boardId: BoardId; from: string; to: string }
>

/**
 * A Board member changed a task's description. Translated to
 * `boards.TaskDescriptionChanged.v1`.
 */
export type TaskDescriptionChanged = DomainEvent<
  'TaskDescriptionChanged',
  { taskId: TaskId; boardId: BoardId; from: string; to: string }
>

/**
 * A Board member moved a task into another list, which changes its status.
 * Translated to `boards.TaskMoved.v1`.
 */
export type TaskMoved = DomainEvent<
  'TaskMoved',
  { taskId: TaskId; boardId: BoardId; fromListId: ListId; toListId: ListId }
>

/**
 * A Board member moved a task to another place in its own list. Positions
 * are opaque keys, so the event carries no `from` or `to`. Translated to
 * `boards.TaskReordered.v1`.
 */
export type TaskReordered = DomainEvent<
  'TaskReordered',
  { taskId: TaskId; boardId: BoardId; listId: ListId }
>

/** A Board member made `userId` an assignee. Translated to `boards.TaskAssigned.v1`. */
export type TaskAssigned = DomainEvent<
  'TaskAssigned',
  { taskId: TaskId; boardId: BoardId; userId: UserId }
>

/**
 * `userId` stopped being an assignee, because a Board member unassigned them
 * or because they left the board. Translated to `boards.TaskUnassigned.v1`.
 */
export type TaskUnassigned = DomainEvent<
  'TaskUnassigned',
  { taskId: TaskId; boardId: BoardId; userId: UserId }
>

export type TaskEvent =
  | TaskCreated
  | TaskRenamed
  | TaskDescriptionChanged
  | TaskMoved
  | TaskReordered
  | TaskAssigned
  | TaskUnassigned
