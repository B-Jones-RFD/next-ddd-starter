import type { TaskArchived } from '@/modules/boards/domain/task/task.events'
import type { IntegrationEvent } from '@/shared/kernel/events'

/** `boards.TaskArchived.v1`: a task was archived, keeping its list and place. */
export type TaskArchivedV1 = IntegrationEvent<
  'boards.TaskArchived',
  { taskId: string; boardId: string; listId: string }
>

export function toTaskArchivedV1(event: TaskArchived): TaskArchivedV1 {
  return {
    type: 'boards.TaskArchived',
    version: 1,
    payload: {
      taskId: event.payload.taskId,
      boardId: event.payload.boardId,
      listId: event.payload.listId,
    },
  }
}
