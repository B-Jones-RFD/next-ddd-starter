import { z } from 'zod'

import { getInjection } from '@/di/container'
import { roleOf } from '@/modules/boards/domain/board/board'
import { toBoardId } from '@/modules/boards/domain/board/board-id'
import { createList as createListOperation } from '@/modules/boards/domain/list/list'
import { toListId } from '@/modules/boards/domain/list/list-id'
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

const CreateListInput = z.object({
  actorId: z.string().min(1),
  boardId: z.string().min(1),
  name: z.string(),
})

export type CreateListInput = {
  actorId: UserId
  boardId: string
  name: string
}

/** A Board member adds a list to the end of the board. */
export async function createList(
  input: CreateListInput
): Promise<
  Result<
    { listId: string },
    ValidationError | NotFoundError | ForbiddenError | ConflictError
  >
> {
  const shape = CreateListInput.safeParse(input)
  if (!shape.success) {
    return err(ValidationError.fromShape(input, shape.error.issues))
  }

  // Read-checks, outside the list's transaction (§3).
  const boards = await getInjection('IBoardRepository')
  const board = await boards.findById(toBoardId(shape.data.boardId))
  if (!board.ok) return board
  const lists = await getInjection('IListRepository')
  const last = await lists.findLastOnBoard(board.value.id)

  const ids = await getInjection('IIdGenerator')
  const created = createListOperation({
    id: toListId(ids.next()),
    boardId: board.value.id,
    membership: roleOf(board.value, input.actorId),
    name: shape.data.name,
    after: last?.position ?? null,
    now: new Date(),
  })
  if (!created.ok) return created

  const saved = await lists.save(created.value.state, created.value.events, {
    actorId: input.actorId,
    causationId: null,
  })
  return saved.ok ? ok({ listId: saved.value.id }) : saved
}
