import { z } from 'zod'

import { getInjection } from '@/di/container'
import type { TaskDto } from '@/modules/boards/application/dto/task.dto'
import type { NotFoundError } from '@/shared/kernel/errors/app-error'
import {
  type ForbiddenError,
  ValidationError,
} from '@/shared/kernel/errors/domain-error'
import { err, type Result } from '@/shared/kernel/result'
import type { UserId } from '@/shared/kernel/user-id'

const GetTaskInput = z.object({
  actorId: z.string().min(1),
  taskId: z.string().min(1),
})

/**
 * One task, for the task dialog and page, for a Board member of its board.
 * `ForbiddenError` for anyone else, and `NotFoundError` if there is no such
 * task.
 */
export async function getTask(input: {
  actorId: UserId
  taskId: string
}): Promise<Result<TaskDto, ValidationError | NotFoundError | ForbiddenError>> {
  const shape = GetTaskInput.safeParse(input)
  if (!shape.success) {
    return err(ValidationError.fromShape(input, shape.error.issues))
  }
  const boards = await getInjection('IBoardReader')
  return boards.getTaskForMember(shape.data.taskId, input.actorId)
}
