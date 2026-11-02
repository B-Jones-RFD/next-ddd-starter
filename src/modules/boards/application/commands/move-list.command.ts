import { z } from 'zod'

import { getInjection } from '@/di/container'
import { roleOf } from '@/modules/boards/domain/board/board'
import {
  moveList as moveListOperation,
  type List,
} from '@/modules/boards/domain/list/list'
import { toListId } from '@/modules/boards/domain/list/list-id'
import type { IListRepository } from '@/modules/boards/domain/list/list-repository.port'
import type {
  ConflictError,
  NotFoundError,
} from '@/shared/kernel/errors/app-error'
import {
  type ForbiddenError,
  ValidationError,
} from '@/shared/kernel/errors/domain-error'
import { err, ok, type Result } from '@/shared/kernel/result'
import type { UserId } from '@/shared/kernel/user-id'

const MoveListInput = z.object({
  actorId: z.string().min(1),
  listId: z.string().min(1),
  after: z.string().min(1).optional(),
  before: z.string().min(1).optional(),
})

export type MoveListInput = {
  actorId: UserId
  listId: string
  /** The list it should follow; leave out to move it first. */
  after?: string
  /** The list it should precede; leave out to move it last. */
  before?: string
}

async function neighbour(
  lists: IListRepository,
  id: string | undefined
): Promise<Result<List | undefined, NotFoundError>> {
  return id === undefined ? ok(undefined) : lists.findById(toListId(id))
}

/**
 * A Board member moves a list between `after` and `before`. Only the moved
 * list's row is written, so moves of different lists never conflict.
 */
export async function moveList(
  input: MoveListInput
): Promise<
  Result<void, ValidationError | NotFoundError | ForbiddenError | ConflictError>
> {
  const shape = MoveListInput.safeParse(input)
  if (!shape.success) {
    return err(ValidationError.fromShape(input, shape.error.issues))
  }

  const lists = await getInjection('IListRepository')
  const list = await lists.findById(toListId(shape.data.listId))
  if (!list.ok) return list
  // Read-checks of membership and the neighbours, outside the transaction (§3).
  const boards = await getInjection('IBoardRepository')
  const board = await boards.findById(list.value.boardId)
  if (!board.ok) return board
  const after = await neighbour(lists, shape.data.after)
  if (!after.ok) return after
  const before = await neighbour(lists, shape.data.before)
  if (!before.ok) return before

  const moved = moveListOperation(
    list.value,
    roleOf(board.value, input.actorId),
    { after: after.value, before: before.value }
  )
  if (!moved.ok) return moved
  if (moved.value.events.length === 0) return ok(undefined)

  const saved = await lists.save(moved.value.state, moved.value.events, {
    actorId: input.actorId,
    causationId: null,
  })
  return saved.ok ? ok(undefined) : saved
}
