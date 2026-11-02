import { z } from 'zod'

import { getInjection } from '@/di/container'
import type { LogPageDto } from '@/modules/audit/application/dto/activity.dto'
import {
  pageRequest,
  subjectName,
  toPage,
} from '@/modules/audit/application/pages/entry-pages'
import {
  ForbiddenError,
  ValidationError,
} from '@/shared/kernel/errors/domain-error'
import { err, ok, type Result } from '@/shared/kernel/result'
import type { UserId } from '@/shared/kernel/user-id'

const GetBoardLogInput = z.object({
  actorId: z.string().min(1),
  boardId: z.string().min(1),
  before: z.string().min(1).optional(),
  includeReorders: z.boolean().optional(),
})

export type GetBoardLogInput = {
  actorId: UserId
  boardId: string
  /** The `olderBefore` of the page before; leave out for the newest page. */
  before?: string
  /** Show reorders too; they are hidden by default. */
  includeReorders?: boolean
}

/**
 * A board's Board log: every entry about the board, its members, lists and
 * tasks, newest first, 50 a page, with reorders hidden unless asked for.
 * Readable only by the board's Owner, checked at read time, so a former
 * Owner loses access as soon as ownership passes on.
 */
export async function getBoardLog(
  input: GetBoardLogInput
): Promise<Result<LogPageDto, ValidationError | ForbiddenError>> {
  const shape = GetBoardLogInput.safeParse(input)
  if (!shape.success) {
    return err(ValidationError.fromShape(input, shape.error.issues))
  }
  const { boardId } = shape.data
  const access = await getInjection('IBoardAccess')
  if ((await access.roleOf(boardId, input.actorId)) !== 'owner') {
    return err(new ForbiddenError())
  }

  const reader = await getInjection('IActivityReader')
  const found = await reader.forBoard(boardId, pageRequest(shape.data))
  return ok(await toPage(reader, found, subjectName))
}
