import type { TaskMoved } from '@/modules/boards/domain/task/task.events'
import type { IntegrationEvent } from '@/shared/kernel/events'

/** `boards.TaskMoved.v1`: a task moved from list `fromListId` to `toListId`. */
export type TaskMovedV1 = IntegrationEvent<
  'boards.TaskMoved',
  { taskId: string; boardId: string; fromListId: string; toListId: string }
>

export function toTaskMovedV1(event: TaskMoved): TaskMovedV1 {
  return {
    type: 'boards.TaskMoved',
    version: 1,
    payload: {
      taskId: event.payload.taskId,
      boardId: event.payload.boardId,
      fromListId: event.payload.fromListId,
      toListId: event.payload.toListId,
    },
  }
}
