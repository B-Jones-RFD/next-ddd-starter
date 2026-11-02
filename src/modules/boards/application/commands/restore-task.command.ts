import { z } from 'zod'

import { getInjection } from '@/di/container'
import { roleOf } from '@/modules/boards/domain/board/board'
import type { ListArchivedError } from '@/modules/boards/domain/list/list.errors'
import { restoreTask as restoreTaskOperation } from '@/modules/boards/domain/services/archiving.service'
import { toTaskId } from '@/modules/boards/domain/task/task-id'
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

const RestoreTaskInput = z.object({
  actorId: z.string().min(1),
  taskId: z.string().min(1),
})

export type RestoreTaskInput = {
  actorId: UserId
  taskId: string
}

/**
 * A Board member restores an archived task to its old place. Its list is a
 * read-check: a task never reappears in an archived list.
 */
export async function restoreTask(
  input: RestoreTaskInput
): Promise<
  Result<
    void,
    | ValidationError
    | NotFoundError
    | ForbiddenError
    | ListArchivedError
    | ConflictError
  >
> {
  const shape = RestoreTaskInput.safeParse(input)
  if (!shape.success) {
    return err(ValidationError.fromShape(input, shape.error.issues))
  }

  const tasks = await getInjection('ITaskRepository')
  const task = await tasks.findById(toTaskId(shape.data.taskId))
  if (!task.ok) return task
  // Read-checks of membership and the task's list, outside the transaction
  // (§3). The list archived meanwhile races with this, which is accepted (§13).
  const boards = await getInjection('IBoardRepository')
  const board = await boards.findById(task.value.boardId)
  if (!board.ok) return board
  const lists = await getInjection('IListRepository')
  const list = await lists.findById(task.value.listId)
  if (!list.ok) return list

  const changed = restoreTaskOperation(
    task.value,
    roleOf(board.value, input.actorId),
    list.value
  )
  if (!changed.ok) return changed
  if (changed.value.events.length === 0) return ok(undefined)

  const saved = await tasks.save(changed.value.state, changed.value.events, {
    actorId: input.actorId,
    causationId: null,
  })
  return saved.ok ? ok(undefined) : saved
}
