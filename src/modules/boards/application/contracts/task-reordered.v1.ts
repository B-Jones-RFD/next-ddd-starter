import type { TaskReordered } from '@/modules/boards/domain/task/task.events'
import type { IntegrationEvent } from '@/shared/kernel/events'

/**
 * `boards.TaskReordered.v1`: a task moved to another place in its own list.
 * Positions are opaque keys, so there is no `from` or `to`.
 */
export type TaskReorderedV1 = IntegrationEvent<
  'boards.TaskReordered',
  { taskId: string; boardId: string; listId: string }
>

export function toTaskReorderedV1(event: TaskReordered): TaskReorderedV1 {
  return {
    type: 'boards.TaskReordered',
    version: 1,
    payload: {
      taskId: event.payload.taskId,
      boardId: event.payload.boardId,
      listId: event.payload.listId,
    },
  }
}
