import type { TaskRestored } from '@/modules/boards/domain/task/task.events'
import type { IntegrationEvent } from '@/shared/kernel/events'

/** `boards.TaskRestored.v1`: an archived task was restored to its old place. */
export type TaskRestoredV1 = IntegrationEvent<
  'boards.TaskRestored',
  { taskId: string; boardId: string; listId: string }
>

export function toTaskRestoredV1(event: TaskRestored): TaskRestoredV1 {
  return {
    type: 'boards.TaskRestored',
    version: 1,
    payload: {
      taskId: event.payload.taskId,
      boardId: event.payload.boardId,
      listId: event.payload.listId,
    },
  }
}
