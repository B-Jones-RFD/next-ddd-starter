import { z } from 'zod'

import { getInjection } from '@/di/container'
import { roleOf } from '@/modules/boards/domain/board/board'
import { changeTaskDescription as changeTaskDescriptionOperation } from '@/modules/boards/domain/task/task'
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

const ChangeTaskDescriptionInput = z.object({
  actorId: z.string().min(1),
  taskId: z.string().min(1),
  description: z.string(),
})

export type ChangeTaskDescriptionInput = {
  actorId: UserId
  taskId: string
  description: string
}

/** A Board member changes a task's description, or clears it. */
export async function changeTaskDescription(
  input: ChangeTaskDescriptionInput
): Promise<
  Result<void, ValidationError | NotFoundError | ForbiddenError | ConflictError>
> {
  const shape = ChangeTaskDescriptionInput.safeParse(input)
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

  const changed = changeTaskDescriptionOperation(
    task.value,
    roleOf(board.value, input.actorId),
    shape.data.description
  )
  if (!changed.ok) return changed
  if (changed.value.events.length === 0) return ok(undefined)

  const saved = await tasks.save(changed.value.state, changed.value.events, {
    actorId: input.actorId,
    causationId: null,
  })
  return saved.ok ? ok(undefined) : saved
}
