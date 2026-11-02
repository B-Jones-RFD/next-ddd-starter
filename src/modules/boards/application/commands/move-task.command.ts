import { z } from 'zod'

import { getInjection } from '@/di/container'
import { roleOf } from '@/modules/boards/domain/board/board'
import type { ListArchivedError } from '@/modules/boards/domain/list/list.errors'
import { toListId } from '@/modules/boards/domain/list/list-id'
import { moveTask as moveTaskOperation } from '@/modules/boards/domain/services/task-placement.service'
import type { Task } from '@/modules/boards/domain/task/task'
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

const MoveTaskInput = z.object({
  actorId: z.string().min(1),
  taskId: z.string().min(1),
  toListId: z.string().min(1),
  after: z.string().min(1).optional(),
  before: z.string().min(1).optional(),
})

export type MoveTaskInput = {
  actorId: UserId
  taskId: string
  /** The list it goes to, which may be its own. */
  toListId: string
  /** The task in that list it should follow; leave out to put it first. */
  after?: string
  /** The task in that list it should precede; leave out to put it last. */
  before?: string
}

async function neighbour(
  tasks: ITaskRepository,
  id: string | undefined
): Promise<Result<Task | undefined, NotFoundError>> {
  return id === undefined ? ok(undefined) : tasks.findById(toTaskId(id))
}

/**
 * A Board member moves a task to a list and a place in it ("Move to list…").
 * The target list is a read-check, so only the task's row is written, and
 * concurrent edits of other tasks never conflict.
 */
export async function moveTask(
  input: MoveTaskInput
): Promise<
  Result<
    void,
    | ValidationError
    | NotFoundError
    | ForbiddenError
    | ConflictError
    | ListArchivedError
  >
> {
  const shape = MoveTaskInput.safeParse(input)
  if (!shape.success) {
    return err(ValidationError.fromShape(input, shape.error.issues))
  }

  const tasks = await getInjection('ITaskRepository')
  const task = await tasks.findById(toTaskId(shape.data.taskId))
  if (!task.ok) return task
  // Read-checks of membership, the target list and the neighbours, outside
  // the transaction (§3). Races with them are accepted (§13).
  const boards = await getInjection('IBoardRepository')
  const board = await boards.findById(task.value.boardId)
  if (!board.ok) return board
  const lists = await getInjection('IListRepository')
  const toList = await lists.findById(toListId(shape.data.toListId))
  if (!toList.ok) return toList
  const after = await neighbour(tasks, shape.data.after)
  if (!after.ok) return after
  const before = await neighbour(tasks, shape.data.before)
  if (!before.ok) return before

  const moved = moveTaskOperation(
    task.value,
    roleOf(board.value, input.actorId),
    { toList: toList.value, after: after.value, before: before.value }
  )
  if (!moved.ok) return moved
  if (moved.value.events.length === 0) return ok(undefined)

  const saved = await tasks.save(moved.value.state, moved.value.events, {
    actorId: input.actorId,
    causationId: null,
  })
  return saved.ok ? ok(undefined) : saved
}
