import type { Role } from '@/modules/boards/domain/board/board'
import type { BoardId } from '@/modules/boards/domain/board/board-id'
import type { ListId } from '@/modules/boards/domain/list/list-id'
import {
  parseListName,
  type ListName,
} from '@/modules/boards/domain/list/list-name'
import { ListArchivedError } from '@/modules/boards/domain/list/list.errors'
import type { ListEvent } from '@/modules/boards/domain/list/list.events'
import { ConflictError, NotFoundError } from '@/shared/kernel/errors/app-error'
import {
  ForbiddenError,
  type ValidationError,
} from '@/shared/kernel/errors/domain-error'
import { keyBetween } from '@/shared/kernel/key-between'
import { err, ok, type Result } from '@/shared/kernel/result'

/** A named, ordered column on a board that holds tasks. */
export type List = {
  readonly id: ListId
  readonly boardId: BoardId
  readonly name: ListName
  /** A fractional key: lists sort by `(position, id)` (§3). */
  readonly position: string
  readonly archived: boolean
  readonly createdAt: Date
  /** Owned by persistence: 0 until first saved (§5). */
  readonly version: number
}

/**
 * The actor's role on the list's board, read from the loaded Board before
 * the operation (a read-check), or undefined if they aren't a Board member.
 */
export type Membership = Role | undefined

type Change = { state: List; events: ListEvent[] }

/** A list takes new tasks, and tasks moved into it, only while it's active. */
export function acceptTasks(list: List): Result<List, ListArchivedError> {
  return list.archived ? err(new ListArchivedError()) : ok(list)
}

/** A Board member adds a list to the end of the board, after `after`. */
export function createList(input: {
  id: ListId
  boardId: BoardId
  membership: Membership
  name: string
  /** The position of the board's last list, or null if it has none. */
  after: string | null
  now: Date
}): Result<Change, ValidationError | ForbiddenError> {
  if (!input.membership) return err(new ForbiddenError())
  const name = parseListName(input.name)
  if (!name.ok) return name
  return ok({
    state: {
      id: input.id,
      boardId: input.boardId,
      name: name.value,
      position: keyBetween(input.after, null),
      archived: false,
      createdAt: input.now,
      version: 0,
    },
    events: [
      {
        type: 'ListCreated',
        payload: { listId: input.id, boardId: input.boardId, name: name.value },
      },
    ],
  })
}

/** A Board member renames a list. The same name raises nothing. */
export function renameList(
  list: List,
  membership: Membership,
  rawName: string
): Result<Change, ValidationError | ForbiddenError> {
  if (!membership) return err(new ForbiddenError())
  const name = parseListName(rawName)
  if (!name.ok) return name
  if (name.value === list.name) return ok({ state: list, events: [] })
  return ok({
    state: { ...list, name: name.value },
    events: [
      {
        type: 'ListRenamed',
        payload: {
          listId: list.id,
          boardId: list.boardId,
          from: list.name,
          to: name.value,
        },
      },
    ],
  })
}

/**
 * A Board member moves a list to sit after `after` and before `before`, the
 * lists that will be its neighbours (give one to move it first or last).
 * Only the moved list changes. Neighbours out of order mean the page was
 * stale, so that's a `ConflictError`.
 */
export function moveList(
  list: List,
  membership: Membership,
  place: { after?: List; before?: List }
): Result<Change, ForbiddenError | NotFoundError | ConflictError> {
  if (!membership) return err(new ForbiddenError())
  const { after, before } = place
  for (const neighbour of [after, before]) {
    if (!neighbour) continue
    if (neighbour.boardId !== list.boardId) {
      return err(new NotFoundError('List', neighbour.id))
    }
    if (neighbour.id === list.id) {
      return err(new ConflictError('List', list.id))
    }
  }
  if (!after && !before) return ok({ state: list, events: [] })
  if (after && before && after.position >= before.position) {
    return err(new ConflictError('List', list.id))
  }
  return ok({
    state: {
      ...list,
      position: keyBetween(after?.position ?? null, before?.position ?? null),
    },
    events: [
      {
        type: 'ListReordered',
        payload: { listId: list.id, boardId: list.boardId },
      },
    ],
  })
}
