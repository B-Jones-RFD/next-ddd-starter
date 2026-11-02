import type { TaskUnassigned } from '@/modules/boards/domain/task/task.events'
import type { IntegrationEvent } from '@/shared/kernel/events'

/**
 * `boards.TaskUnassigned.v1`: `userId` stopped being an assignee of a task.
 * When they left the board or were removed from it, the envelope's
 * `causationId` names that event.
 */
export type TaskUnassignedV1 = IntegrationEvent<
  'boards.TaskUnassigned',
  { taskId: string; boardId: string; userId: string }
>

export function toTaskUnassignedV1(event: TaskUnassigned): TaskUnassignedV1 {
  return {
    type: 'boards.TaskUnassigned',
    version: 1,
    payload: {
      taskId: event.payload.taskId,
      boardId: event.payload.boardId,
      userId: event.payload.userId,
    },
  }
}
