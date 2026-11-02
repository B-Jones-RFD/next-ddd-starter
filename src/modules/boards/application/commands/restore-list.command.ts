import { z } from 'zod'

import { getInjection } from '@/di/container'
import { roleOf } from '@/modules/boards/domain/board/board'
import { restoreList as restoreListOperation } from '@/modules/boards/domain/list/list'
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

const RestoreListInput = z.object({
  actorId: z.string().min(1),
  listId: z.string().min(1),
})

export type RestoreListInput = {
  actorId: UserId
  listId: string
}

/** A Board member restores an archived list to its old place. */
export async function restoreList(
  input: RestoreListInput
): Promise<
  Result<void, ValidationError | NotFoundError | ForbiddenError | ConflictError>
> {
  const shape = RestoreListInput.safeParse(input)
  if (!shape.success) {
    return err(ValidationError.fromShape(input, shape.error.issues))
  }

  const lists = await getInjection('IListRepository')
  const list = await lists.findById(toListId(shape.data.listId))
  if (!list.ok) return list
  // Read-check of the actor's membership, outside the transaction (§3).
  const boards = await getInjection('IBoardRepository')
  const board = await boards.findById(list.value.boardId)
  if (!board.ok) return board

  const changed = restoreListOperation(
    list.value,
    roleOf(board.value, input.actorId)
  )
  if (!changed.ok) return changed
  if (changed.value.events.length === 0) return ok(undefined)

  const saved = await lists.save(changed.value.state, changed.value.events, {
    actorId: input.actorId,
    causationId: null,
  })
  return saved.ok ? ok(undefined) : saved
}
