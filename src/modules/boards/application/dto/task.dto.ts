/** An assignee of a task, as its card and dialog name them. */
export type AssigneeDto = {
  userId: string
  /** From boards' people projection; null until boards learns it. */
  displayName: string | null
}

/** A task as its list's column shows it. */
export type TaskSummaryDto = {
  id: string
  title: string
  /** In the order they were assigned. */
  assignees: AssigneeDto[]
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
  /** In the order they were assigned. */
  assignees: AssigneeDto[]
}
