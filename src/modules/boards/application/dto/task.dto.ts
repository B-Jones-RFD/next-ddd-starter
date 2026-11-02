/** A task as its list's column shows it. */
export type TaskSummaryDto = {
  id: string
  title: string
}

/** One task, as its dialog and page show it to a Board member. */
export type TaskDto = {
  id: string
  title: string
  description: string
  archived: boolean
  boardId: string
  boardName: string
  /** An archived board is read-only, its active tasks included. */
  boardArchived: boolean
  listId: string
  listName: string
}
