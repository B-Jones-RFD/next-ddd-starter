import { z } from 'zod'

import { getInjection } from '@/di/container'
import { toTagId } from '@/modules/boards/domain/board/tag'
import { untagTask as untagTaskOperation } from '@/modules/boards/domain/services/task-tagging.service'
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

const UntagTaskInput = z.object({
  actorId: z.string().min(1),
  taskId: z.string().min(1),
  tagId: z.string().min(1),
})

export type UntagTaskInput = {
  actorId: UserId
  taskId: string
  tagId: string
}

/**
 * A Board member detaches one of the board's tags from a task. The board is
 * a read-check of the actor and the tag, loaded outside the task's
 * transaction (§3), so only the task is written.
 */
export async function untagTask(
  input: UntagTaskInput
): Promise<
  Result<void, ValidationError | NotFoundError | ForbiddenError | ConflictError>
> {
  const shape = UntagTaskInput.safeParse(input)
  if (!shape.success) {
    return err(ValidationError.fromShape(input, shape.error.issues))
  }

  const tasks = await getInjection('ITaskRepository')
  const task = await tasks.findById(toTaskId(shape.data.taskId))
  if (!task.ok) return task
  const boards = await getInjection('IBoardRepository')
  const board = await boards.findById(task.value.boardId)
  if (!board.ok) return board

  const changed = untagTaskOperation(
    task.value,
    board.value,
    input.actorId,
    toTagId(shape.data.tagId)
  )
  if (!changed.ok) return changed
  if (changed.value.events.length === 0) return ok(undefined)

  const saved = await tasks.save(changed.value.state, changed.value.events, {
    actorId: input.actorId,
    causationId: null,
  })
  return saved.ok ? ok(undefined) : saved
}
