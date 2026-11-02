// Shared by the board's server and client parts: where a list can move, and
// the id of each list's heading, which the jump strip focuses.

/** A place in the board's order, as the lists it would sit between. */
export type ListPlace = { after?: string; before?: string }

export type ListMove = 'left' | 'right' | 'first' | 'last'

/**
 * How the board shows its lists: the Active view, editable; the Archived
 * view, where archived items can only be restored; or read-only, for an
 * archived board.
 */
export type BoardMode = 'active' | 'archived' | 'read-only'

/** The moves open to the list at `index`, by its current neighbours. */
export function movesFor(
  ids: readonly string[],
  index: number
): Partial<Record<ListMove, ListPlace>> {
  const moves: Partial<Record<ListMove, ListPlace>> = {}
  if (index > 0) {
    moves.left = { after: ids[index - 2], before: ids[index - 1] }
    moves.first = { before: ids[0] }
  }
  if (index < ids.length - 1) {
    moves.right = { after: ids[index + 1], before: ids[index + 2] }
    moves.last = { after: ids.at(-1) }
  }
  return moves
}

/** The DOM id of a list's `h2`. */
export function listHeadingId(listId: string): string {
  return `list-${listId}-heading`
}
