import type { TaskSummaryDto } from '@/modules/boards/application/dto/task.dto'

/** An active list, as the board shows it. */
export type ListDto = {
  id: string
  name: string
  /** Its active tasks, in list order. */
  tasks: TaskSummaryDto[]
}
