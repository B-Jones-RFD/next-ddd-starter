import { z } from 'zod'

import { getInjection } from '@/di/container'
import type { ActivityPageDto } from '@/modules/audit/application/dto/activity.dto'
import {
  pageRequest,
  toPage,
} from '@/modules/audit/application/pages/entry-pages'
import {
  ForbiddenError,
  ValidationError,
} from '@/shared/kernel/errors/domain-error'
import { err, ok, type Result } from '@/shared/kernel/result'
import type { UserId } from '@/shared/kernel/user-id'

const GetActivityInput = z.object({
  actorId: z.string().min(1),
  taskId: z.string().min(1),
  before: z.string().min(1).optional(),
  includeReorders: z.boolean().optional(),
})

export type GetActivityInput = {
  actorId: UserId
  taskId: string
  /** The `olderBefore` of the page before; leave out for the newest page. */
  before?: string
  /** Show the task's reorders too; they are hidden by default. */
  includeReorders?: boolean
}

/**
 * A task's Activity: its Audit entries, newest first, 50 a page, with
 * reorders hidden unless asked for. Readable by any Board member of its
 * board, checked at read time, so a removed member loses access at once.
 */
export async function getActivity(
  input: GetActivityInput
): Promise<Result<ActivityPageDto, ValidationError | ForbiddenError>> {
  const shape = GetActivityInput.safeParse(input)
  if (!shape.success) {
    return err(ValidationError.fromShape(input, shape.error.issues))
  }
  const { taskId } = shape.data
  const reader = await getInjection('IActivityReader')

  const boardId = await reader.boardOfTask(taskId)
  if (boardId === null) return ok({ entries: [], names: {}, olderBefore: null })
  const access = await getInjection('IBoardAccess')
  if ((await access.roleOf(boardId, input.actorId)) === null) {
    return err(new ForbiddenError())
  }

  const found = await reader.forTask(taskId, pageRequest(shape.data))
  return ok(await toPage(reader, found))
}
