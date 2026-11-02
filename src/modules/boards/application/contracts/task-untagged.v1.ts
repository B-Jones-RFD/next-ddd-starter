import type { TaskUntagged } from '@/modules/boards/domain/task/task.events'
import type { IntegrationEvent } from '@/shared/kernel/events'

/**
 * `boards.TaskUntagged.v1`: a tag left a task. A non-null `causationId`
 * means it was the Consequence of `boards.TagDeleted.v1`.
 */
export type TaskUntaggedV1 = IntegrationEvent<
  'boards.TaskUntagged',
  { taskId: string; boardId: string; tagId: string }
>

export function toTaskUntaggedV1(event: TaskUntagged): TaskUntaggedV1 {
  return {
    type: 'boards.TaskUntagged',
    version: 1,
    payload: {
      taskId: event.payload.taskId,
      boardId: event.payload.boardId,
      tagId: event.payload.tagId,
    },
  }
}
