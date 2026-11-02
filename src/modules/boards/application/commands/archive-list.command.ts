import { z } from 'zod'

import { getInjection } from '@/di/container'
import { roleOf } from '@/modules/boards/domain/board/board'
import type { ListHasActiveTasksError } from '@/modules/boards/domain/list/list.errors'
import { toListId } from '@/modules/boards/domain/list/list-id'
import { archiveList as archiveListOperation } from '@/modules/boards/domain/services/archiving.service'
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

const ArchiveListInput = z.object({
  actorId: z.string().min(1),
  listId: z.string().min(1),
})

export type ArchiveListInput = {
  actorId: UserId
  listId: string
}

/**
 * A Board member archives a list once none of its tasks are active. The
 * tasks are a read-check, so only the list's row is written.
 */
export async function archiveList(
  input: ArchiveListInput
): Promise<
  Result<
    void,
    | ValidationError
    | NotFoundError
    | ForbiddenError
    | ListHasActiveTasksError
    | ConflictError
  >
> {
  const shape = ArchiveListInput.safeParse(input)
  if (!shape.success) {
    return err(ValidationError.fromShape(input, shape.error.issues))
  }

  const lists = await getInjection('IListRepository')
  const list = await lists.findById(toListId(shape.data.listId))
  if (!list.ok) return list
  // Read-checks of membership and the list's tasks, outside the transaction
  // (§3). A task added meanwhile races with this, which is accepted (§13).
  const boards = await getInjection('IBoardRepository')
  const board = await boards.findById(list.value.boardId)
  if (!board.ok) return board
  const tasks = await getInjection('ITaskRepository')
  const inList = await tasks.findInList(list.value.id)

  const changed = archiveListOperation(
    list.value,
    roleOf(board.value, input.actorId),
    inList
  )
  if (!changed.ok) return changed
  if (changed.value.events.length === 0) return ok(undefined)

  const saved = await lists.save(changed.value.state, changed.value.events, {
    actorId: input.actorId,
    causationId: null,
  })
  return saved.ok ? ok(undefined) : saved
}
