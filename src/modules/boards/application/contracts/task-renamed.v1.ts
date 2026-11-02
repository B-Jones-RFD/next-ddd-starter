import type { TaskRenamed } from '@/modules/boards/domain/task/task.events'
import type { IntegrationEvent } from '@/shared/kernel/events'

/** `boards.TaskRenamed.v1`: a task's title changed `from` → `to`. */
export type TaskRenamedV1 = IntegrationEvent<
  'boards.TaskRenamed',
  { taskId: string; boardId: string; from: string; to: string }
>

export function toTaskRenamedV1(event: TaskRenamed): TaskRenamedV1 {
  return {
    type: 'boards.TaskRenamed',
    version: 1,
    payload: {
      taskId: event.payload.taskId,
      boardId: event.payload.boardId,
      from: event.payload.from,
      to: event.payload.to,
    },
  }
}
