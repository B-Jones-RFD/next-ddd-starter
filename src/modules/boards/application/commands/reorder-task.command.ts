import { z } from 'zod'

import { getInjection } from '@/di/container'
import type { TaskArchivedError } from '@/modules/boards/domain/task/task.errors'
import { roleOf } from '@/modules/boards/domain/board/board'
import {
  reorderTask as reorderTaskOperation,
  type Task,
} from '@/modules/boards/domain/task/task'
import { toTaskId } from '@/modules/boards/domain/task/task-id'
import type { ITaskRepository } from '@/modules/boards/domain/task/task-repository.port'
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

const ReorderTaskInput = z.object({
  actorId: z.string().min(1),
  taskId: z.string().min(1),
  after: z.string().min(1).optional(),
  before: z.string().min(1).optional(),
})

export type ReorderTaskInput = {
  actorId: UserId
  taskId: string
  /** The task it should follow; leave out to move it first. */
  after?: string
  /** The task it should precede; leave out to move it last. */
  before?: string
}

async function neighbour(
  tasks: ITaskRepository,
  id: string | undefined
): Promise<Result<Task | undefined, NotFoundError>> {
  return id === undefined ? ok(undefined) : tasks.findById(toTaskId(id))
}

/**
 * A Board member moves a task up, down, first or last in its own list. Only
 * the moved task's row is written.
 */
export async function reorderTask(
  input: ReorderTaskInput
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
  const shape = ReorderTaskInput.safeParse(input)
  if (!shape.success) {
    return err(ValidationError.fromShape(input, shape.error.issues))
  }

  const tasks = await getInjection('ITaskRepository')
  const task = await tasks.findById(toTaskId(shape.data.taskId))
  if (!task.ok) return task
  // Read-checks of membership and the neighbours, outside the transaction (§3).
  const boards = await getInjection('IBoardRepository')
  const board = await boards.findById(task.value.boardId)
  if (!board.ok) return board
  const after = await neighbour(tasks, shape.data.after)
  if (!after.ok) return after
  const before = await neighbour(tasks, shape.data.before)
  if (!before.ok) return before

  const moved = reorderTaskOperation(
    task.value,
    roleOf(board.value, input.actorId),
    { after: after.value, before: before.value }
  )
  if (!moved.ok) return moved
  if (moved.value.events.length === 0) return ok(undefined)

  const saved = await tasks.save(moved.value.state, moved.value.events, {
    actorId: input.actorId,
    causationId: null,
  })
  return saved.ok ? ok(undefined) : saved
}
