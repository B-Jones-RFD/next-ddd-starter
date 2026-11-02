import { z } from 'zod'

import { getInjection } from '@/di/container'
import type { TaskArchivedError } from '@/modules/boards/domain/task/task.errors'
import { roleOf } from '@/modules/boards/domain/board/board'
import { renameTask as renameTaskOperation } from '@/modules/boards/domain/task/task'
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

const RenameTaskInput = z.object({
  actorId: z.string().min(1),
  taskId: z.string().min(1),
  title: z.string(),
})

export type RenameTaskInput = {
  actorId: UserId
  taskId: string
  title: string
}

/** A Board member renames a task. */
export async function renameTask(
  input: RenameTaskInput
): Promise<
  Result<
    void,
    | ValidationError
    | NotFoundError
    | ForbiddenError
    | TaskArchivedError
    | ConflictError
  >
> {
  const shape = RenameTaskInput.safeParse(input)
  if (!shape.success) {
    return err(ValidationError.fromShape(input, shape.error.issues))
  }

  const tasks = await getInjection('ITaskRepository')
  const task = await tasks.findById(toTaskId(shape.data.taskId))
  if (!task.ok) return task
  // Read-check of the actor's membership, outside the transaction (§3).
  const boards = await getInjection('IBoardRepository')
  const board = await boards.findById(task.value.boardId)
  if (!board.ok) return board

  const renamed = renameTaskOperation(
    task.value,
    roleOf(board.value, input.actorId),
    shape.data.title
  )
  if (!renamed.ok) return renamed
  if (renamed.value.events.length === 0) return ok(undefined)

  const saved = await tasks.save(renamed.value.state, renamed.value.events, {
    actorId: input.actorId,
    causationId: null,
  })
  return saved.ok ? ok(undefined) : saved
}
