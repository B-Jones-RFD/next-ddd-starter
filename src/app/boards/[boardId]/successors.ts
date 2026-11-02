// Where focus goes when an archive or restore takes an item off the board's
// current view (§10): the next item, or the column heading if there isn't
// one. Each is a list of refocus keys in order of preference; the first one
// still on the page after the refresh gets focus.

type Column = { id: string; tasks: readonly { id: string }[] }

/** The refocus key of a list's heading (the `h2` the jump strip focuses). */
export function headingKey(listId: string): string {
  return `heading:${listId}`
}

/** The columns either side of `listId`: the next one first. */
function neighbours(lists: readonly Column[], listId: string): Column[] {
  const index = lists.findIndex((list) => list.id === listId)
  return [lists[index + 1], lists[index - 1]].filter(
    (list): list is Column => list !== undefined
  )
}

/**
 * After task `taskId` leaves its column: the next task's ⋯, else the column
 * heading, else a neighbouring column's heading, for when the column itself
 * leaves the view with it.
 */
export function taskSuccessors(
  lists: readonly Column[],
  listId: string,
  taskId: string
): string[] {
  const tasks = lists.find((list) => list.id === listId)?.tasks ?? []
  const next = tasks[tasks.findIndex((task) => task.id === taskId) + 1]
  return [
    ...(next ? [next.id] : []),
    headingKey(listId),
    ...neighbours(lists, listId).map((list) => headingKey(list.id)),
  ]
}

/**
 * After list `listId` is archived or restored: its own heading if it stays
 * in the view, else the next list's ⋯, else the previous list's.
 */
export function listSuccessors(
  lists: readonly Column[],
  listId: string
): string[] {
  return [
    headingKey(listId),
    ...neighbours(lists, listId).map((list) => list.id),
  ]
}
