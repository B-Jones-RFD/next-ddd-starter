import { z } from 'zod'

import { getInjection } from '@/di/container'
import { unassignTask as unassignTaskOperation } from '@/modules/boards/domain/services/task-assignment.service'
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

const UnassignTaskInput = z.object({
  actorId: z.string().min(1),
  taskId: z.string().min(1),
  userId: z.string().min(1),
})

export type UnassignTaskInput = {
  actorId: UserId
  taskId: string
  /** The assignee to unassign. */
  userId: string
}

/**
 * A Board member unassigns an assignee from a task. Unassigning someone not
 * assigned changes nothing.
 */
export async function unassignTask(
  input: UnassignTaskInput
): Promise<
  Result<void, ValidationError | NotFoundError | ForbiddenError | ConflictError>
> {
  const shape = UnassignTaskInput.safeParse(input)
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

  const unassigned = unassignTaskOperation(
    task.value,
    board.value,
    input.actorId,
    toUserId(shape.data.userId)
  )
  if (!unassigned.ok) return unassigned
  if (unassigned.value.events.length === 0) return ok(undefined)

  const saved = await tasks.save(
    unassigned.value.state,
    unassigned.value.events,
    { actorId: input.actorId, causationId: null }
  )
  return saved.ok ? ok(undefined) : saved
}
