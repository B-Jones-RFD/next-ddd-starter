import { z } from 'zod'

import { getInjection } from '@/di/container'
import type { TaskArchivedError } from '@/modules/boards/domain/task/task.errors'
import type { NotAMemberError } from '@/modules/boards/domain/board/board.errors'
import { assignTask as assignTaskOperation } from '@/modules/boards/domain/services/task-assignment.service'
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
import { toUserId, type UserId } from '@/shared/kernel/user-id'

const AssignTaskInput = z.object({
  actorId: z.string().min(1),
  taskId: z.string().min(1),
  userId: z.string().min(1),
})

export type AssignTaskInput = {
  actorId: UserId
  taskId: string
  /** The Board member to make an assignee. */
  userId: string
}

/**
 * A Board member makes a Board member of the task's board an assignee.
 * Assigning someone already assigned changes nothing.
 */
export async function assignTask(
  input: AssignTaskInput
): Promise<
  Result<
    void,
    | ValidationError
    | NotFoundError
    | ForbiddenError
    | TaskArchivedError
    | NotAMemberError
    | ConflictError
  >
> {
  const shape = AssignTaskInput.safeParse(input)
  if (!shape.success) {
    return err(ValidationError.fromShape(input, shape.error.issues))
  }

  const tasks = await getInjection('ITaskRepository')
  const task = await tasks.findById(toTaskId(shape.data.taskId))
  if (!task.ok) return task
  // Read-check of both people's membership, outside the transaction (§3).
  const boards = await getInjection('IBoardRepository')
  const board = await boards.findById(task.value.boardId)
  if (!board.ok) return board

  const assigned = assignTaskOperation(
    task.value,
    board.value,
    input.actorId,
    toUserId(shape.data.userId)
  )
  if (!assigned.ok) return assigned
  if (assigned.value.events.length === 0) return ok(undefined)

  const saved = await tasks.save(assigned.value.state, assigned.value.events, {
    actorId: input.actorId,
    causationId: null,
  })
  return saved.ok ? ok(undefined) : saved
}
