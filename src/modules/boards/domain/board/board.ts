import type { BoardId } from '@/modules/boards/domain/board/board-id'
import {
  parseBoardName,
  type BoardName,
} from '@/modules/boards/domain/board/board-name'
import {
  AlreadyAMemberError,
  NotAMemberError,
  OwnerMustTransferFirstError,
} from '@/modules/boards/domain/board/board.errors'
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

// #region add-member
/** The actor's role on the board, if they are a Board member. */
export function roleOf(board: Board, userId: UserId): Role | undefined {
  return board.members.find((member) => member.userId === userId)?.role
}

/** The Owner adds a user as a Member. */
export function addMember(
  board: Board,
  actorId: UserId,
  userId: UserId
): Result<Change, ForbiddenError | AlreadyAMemberError> {
  if (roleOf(board, actorId) !== 'owner') return err(new ForbiddenError())
  if (roleOf(board, userId)) return err(new AlreadyAMemberError())
  return ok({
    state: {
      ...board,
      members: [...board.members, { userId, role: 'member' }],
    },
    events: [{ type: 'MemberAdded', payload: { boardId: board.id, userId } }],
  })
}
// #endregion add-member

/** The Owner removes a Member. The Owner can't remove themself. */
export function removeMember(
  board: Board,
  actorId: UserId,
  userId: UserId
): Result<
  Change,
  ForbiddenError | NotAMemberError | OwnerMustTransferFirstError
> {
  if (roleOf(board, actorId) !== 'owner') return err(new ForbiddenError())
  const role = roleOf(board, userId)
  if (!role) return err(new NotAMemberError())
  if (role === 'owner') return err(new OwnerMustTransferFirstError())
  return ok({
    state: without(board, userId),
    events: [{ type: 'MemberRemoved', payload: { boardId: board.id, userId } }],
  })
}

/** A Member leaves the board. The Owner must transfer ownership first. */
export function leaveBoard(
  board: Board,
  actorId: UserId
): Result<Change, ForbiddenError | OwnerMustTransferFirstError> {
  const role = roleOf(board, actorId)
  if (!role) return err(new ForbiddenError())
  if (role === 'owner') return err(new OwnerMustTransferFirstError())
  return ok({
    state: without(board, actorId),
    events: [
      { type: 'MemberLeft', payload: { boardId: board.id, userId: actorId } },
    ],
  })
}

/**
 * The Owner makes another Board member the Owner and becomes a Member, so
 * the board still has exactly one Owner. Transferring to themself raises
 * nothing.
 */
export function transferOwnership(
  board: Board,
  actorId: UserId,
  toUserId: UserId
): Result<Change, ForbiddenError | NotAMemberError> {
  if (roleOf(board, actorId) !== 'owner') return err(new ForbiddenError())
  if (!roleOf(board, toUserId)) return err(new NotAMemberError())
  if (toUserId === actorId) return ok({ state: board, events: [] })
  return ok({
    state: {
      ...board,
      members: board.members.map((member) => ({
        userId: member.userId,
        role: member.userId === toUserId ? 'owner' : 'member',
      })),
    },
    events: [
      {
        type: 'OwnershipTransferred',
        payload: { boardId: board.id, fromUserId: actorId, toUserId },
      },
    ],
  })
}

function without(board: Board, userId: UserId): Board {
  return {
    ...board,
    members: board.members.filter((member) => member.userId !== userId),
  }
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
