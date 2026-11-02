import type { TaskSummaryDto } from '@/modules/boards/application/dto/task.dto'

/** A list, as the board shows it in one view. */
export type ListDto = {
  id: string
  name: string
  archived: boolean
  /** Its tasks in the view, in list order: active ones, or archived ones. */
  tasks: TaskSummaryDto[]
}
