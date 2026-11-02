import { z } from 'zod'

import { getInjection } from '@/di/container'
import { roleOf } from '@/modules/boards/domain/board/board'
import { renameList as renameListOperation } from '@/modules/boards/domain/list/list'
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

const RenameListInput = z.object({
  actorId: z.string().min(1),
  listId: z.string().min(1),
  name: z.string(),
})

export type RenameListInput = {
  actorId: UserId
  listId: string
  name: string
}

/** A Board member renames a list. */
export async function renameList(
  input: RenameListInput
): Promise<
  Result<void, ValidationError | NotFoundError | ForbiddenError | ConflictError>
> {
  const shape = RenameListInput.safeParse(input)
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

  const renamed = renameListOperation(
    list.value,
    roleOf(board.value, input.actorId),
    shape.data.name
  )
  if (!renamed.ok) return renamed
  if (renamed.value.events.length === 0) return ok(undefined)

  const saved = await lists.save(renamed.value.state, renamed.value.events, {
    actorId: input.actorId,
    causationId: null,
  })
  return saved.ok ? ok(undefined) : saved
}
