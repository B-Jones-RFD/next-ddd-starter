import type { BoardId } from '@/modules/boards/domain/board/board-id'
import type { ListId } from '@/modules/boards/domain/list/list-id'
import type { TaskId } from '@/modules/boards/domain/task/task-id'
import type { DomainEvent } from '@/shared/kernel/events'

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

export type TaskEvent =
  TaskCreated | TaskRenamed | TaskDescriptionChanged | TaskMoved | TaskReordered
