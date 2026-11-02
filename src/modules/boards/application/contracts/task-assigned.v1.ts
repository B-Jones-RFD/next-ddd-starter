import type { TaskAssigned } from '@/modules/boards/domain/task/task.events'
import type { IntegrationEvent } from '@/shared/kernel/events'

/**
 * `boards.TaskAssigned.v1`: `userId` became an assignee of a task. When it
 * is a hand-over to the Owner, the envelope's `causationId` names the
 * removal or leaving that caused it.
 */
export type TaskAssignedV1 = IntegrationEvent<
  'boards.TaskAssigned',
  { taskId: string; boardId: string; userId: string }
>

export function toTaskAssignedV1(event: TaskAssigned): TaskAssignedV1 {
  return {
    type: 'boards.TaskAssigned',
    version: 1,
    payload: {
      taskId: event.payload.taskId,
      boardId: event.payload.boardId,
      userId: event.payload.userId,
    },
  }
}
