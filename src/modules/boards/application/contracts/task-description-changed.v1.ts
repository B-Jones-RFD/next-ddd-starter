import type { TaskDescriptionChanged } from '@/modules/boards/domain/task/task.events'
import type { IntegrationEvent } from '@/shared/kernel/events'

/** `boards.TaskDescriptionChanged.v1`: a task's description changed `from` → `to`. */
export type TaskDescriptionChangedV1 = IntegrationEvent<
  'boards.TaskDescriptionChanged',
  { taskId: string; boardId: string; from: string; to: string }
>

export function toTaskDescriptionChangedV1(
  event: TaskDescriptionChanged
): TaskDescriptionChangedV1 {
  return {
    type: 'boards.TaskDescriptionChanged',
    version: 1,
    payload: {
      taskId: event.payload.taskId,
      boardId: event.payload.boardId,
      from: event.payload.from,
      to: event.payload.to,
    },
  }
}
