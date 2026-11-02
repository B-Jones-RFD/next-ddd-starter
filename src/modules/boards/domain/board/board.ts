import type { BoardId } from '@/modules/boards/domain/board/board-id'
import {
  parseBoardName,
  type BoardName,
} from '@/modules/boards/domain/board/board-name'
import type { BoardEvent } from '@/modules/boards/domain/board/board.events'
import {
  ForbiddenError,
  type ValidationError,
} from '@/shared/kernel/errors/domain-error'
import { err, ok, type Result } from '@/shared/kernel/result'
import type { UserId } from '@/shared/kernel/user-id'

/** A Board member's role. A board has exactly one Owner. */
export type Role = 'owner' | 'member'

/** A user on a board, with their one role there. */
export type BoardMember = {
  readonly userId: UserId
  readonly role: Role
}

/** A shared space, visible only to its Board members, that holds lists. */
export type Board = {
  readonly id: BoardId
  readonly name: BoardName
  readonly members: readonly BoardMember[]
  readonly archived: boolean
  readonly createdAt: Date
  /** Owned by persistence: 0 until first saved (§5). */
  readonly version: number
}

type Change = { state: Board; events: BoardEvent[] }

/** A user creates a board and becomes its Owner. */
export function createBoard(input: {
  id: BoardId
  actorId: UserId
  name: string
  now: Date
}): Result<Change, ValidationError> {
  const name = parseBoardName(input.name)
  if (!name.ok) return name
  return ok({
    state: {
      id: input.id,
      name: name.value,
      members: [{ userId: input.actorId, role: 'owner' }],
      archived: false,
      createdAt: input.now,
      version: 0,
    },
    events: [
      {
        type: 'BoardCreated',
        payload: { boardId: input.id, name: name.value },
      },
    ],
  })
}

/** The actor's role on the board, if they are a Board member. */
export function roleOf(board: Board, userId: UserId): Role | undefined {
  return board.members.find((member) => member.userId === userId)?.role
}

/** The Owner renames the board. The same name raises nothing. */
export function renameBoard(
  board: Board,
  actorId: UserId,
  rawName: string
): Result<Change, ValidationError | ForbiddenError> {
  if (roleOf(board, actorId) !== 'owner') return err(new ForbiddenError())
  const name = parseBoardName(rawName)
  if (!name.ok) return name
  if (name.value === board.name) return ok({ state: board, events: [] })
  return ok({
    state: { ...board, name: name.value },
    events: [
      {
        type: 'BoardRenamed',
        payload: { boardId: board.id, from: board.name, to: name.value },
      },
    ],
  })
}
