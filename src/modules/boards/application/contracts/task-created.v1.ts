import type { TaskCreated } from '@/modules/boards/domain/task/task.events'
import type { IntegrationEvent } from '@/shared/kernel/events'

/** `boards.TaskCreated.v1`: a Board member added task `title` to a list. */
export type TaskCreatedV1 = IntegrationEvent<
  'boards.TaskCreated',
  { taskId: string; boardId: string; listId: string; title: string }
>

export function toTaskCreatedV1(event: TaskCreated): TaskCreatedV1 {
  return {
    type: 'boards.TaskCreated',
    version: 1,
    payload: {
      taskId: event.payload.taskId,
      boardId: event.payload.boardId,
      listId: event.payload.listId,
      title: event.payload.title,
    },
  }
}
