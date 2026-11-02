import type { TaskTagged } from '@/modules/boards/domain/task/task.events'
import type { IntegrationEvent } from '@/shared/kernel/events'

/** `boards.TaskTagged.v1`: a tag was attached to a task. */
export type TaskTaggedV1 = IntegrationEvent<
  'boards.TaskTagged',
  { taskId: string; boardId: string; tagId: string }
>

export function toTaskTaggedV1(event: TaskTagged): TaskTaggedV1 {
  return {
    type: 'boards.TaskTagged',
    version: 1,
    payload: {
      taskId: event.payload.taskId,
      boardId: event.payload.boardId,
      tagId: event.payload.tagId,
    },
  }
}
