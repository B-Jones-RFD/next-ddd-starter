// Shared by the board's server and client parts: where a task can go, and the
// DOM ids the task dialog returns focus to.

/** A place in a list, as the tasks it would sit between. */
export type TaskPlace = { after?: string; before?: string }

/** One choice in the "Move to list…" picker's Position select. */
export type PositionChoice = TaskPlace & { label: string; current: boolean }

/**
 * The positions the "Move to list…" picker offers in a list with `tasks`:
 * the top, after each task, and the bottom. The task being moved is left out
 * of its own list, and the place it holds now is marked `current`.
 */
export function placesIn(
  tasks: readonly { id: string; title: string }[],
  taskId: string
): PositionChoice[] {
  const currentIndex = tasks.findIndex((task) => task.id === taskId)
  const others = tasks.filter((task) => task.id !== taskId)
  return Array.from({ length: others.length + 1 }, (_, index) => {
    const after = others[index - 1]
    const before = others[index]
    const label =
      index === 0
        ? '1 (top)'
        : !before
          ? `${index + 1} (bottom)`
          : `${index + 1} (after “${after?.title ?? ''}”)`
    return {
      label,
      ...(after && { after: after.id }),
      ...(before && { before: before.id }),
      current: index === currentIndex,
    }
  })
}

/** The DOM id of a task card's title link, where its dialog returns focus. */
export function taskLinkId(taskId: string): string {
  return `task-${taskId}-link`
}

/**
 * The DOM id of a task's Assignees heading, where focus goes when an
 * Unassign button goes.
 */
export function assigneesHeadingId(taskId: string): string {
  return `task-${taskId}-assignees`
}

/** The path of a task's dialog and page. */
export function taskPath(boardId: string, taskId: string): string {
  return `/boards/${boardId}/tasks/${taskId}`
}
