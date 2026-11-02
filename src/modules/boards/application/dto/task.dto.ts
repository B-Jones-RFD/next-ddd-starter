import type { TagDto } from '@/modules/boards/application/dto/tag.dto'

/** A task as its list's column shows it. */
export type TaskSummaryDto = {
  id: string
  title: string
  /** Its tags still on the board, by name. */
  tags: TagDto[]
}

/** One task, as its dialog and page show it to a Board member. */
export type TaskDto = {
  id: string
  title: string
  description: string
  archived: boolean
  boardId: string
  boardName: string
  listId: string
  listName: string
  /** Its tags still on the board, by name. */
  tags: TagDto[]
}
