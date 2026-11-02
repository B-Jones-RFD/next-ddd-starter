import { z } from 'zod'

import { getInjection } from '@/di/container'
import type { ActivityPageDto } from '@/modules/audit/application/dto/activity.dto'
import {
  namedIds,
  REORDER_ACTIONS,
} from '@/modules/audit/domain/audit-entry/audit-entry'
import {
  ForbiddenError,
  ValidationError,
} from '@/shared/kernel/errors/domain-error'
import { err, ok, type Result } from '@/shared/kernel/result'
import type { UserId } from '@/shared/kernel/user-id'

/** Entries per page (ADR 0010). */
const PAGE_SIZE = 50

const GetActivityInput = z.object({
  actorId: z.string().min(1),
  taskId: z.string().min(1),
  before: z.string().min(1).optional(),
})

export type GetActivityInput = {
  actorId: UserId
  taskId: string
  /** The `olderBefore` of the page before; leave out for the newest page. */
  before?: string
}

/**
 * A task's Activity: its Audit entries, newest first, 50 a page, with
 * reorders hidden. Readable by any Board member of its board, checked at
 * read time, so a removed member loses access at once.
 */
export async function getActivity(
  input: GetActivityInput
): Promise<Result<ActivityPageDto, ValidationError | ForbiddenError>> {
  const shape = GetActivityInput.safeParse(input)
  if (!shape.success) {
    return err(ValidationError.fromShape(input, shape.error.issues))
  }
  const { taskId, before } = shape.data
  const reader = await getInjection('IActivityReader')

  const boardId = await reader.boardOfTask(taskId)
  if (boardId === null) return ok({ entries: [], names: {}, olderBefore: null })
  const access = await getInjection('IBoardAccess')
  if ((await access.roleOf(boardId, input.actorId)) === null) {
    return err(new ForbiddenError())
  }

  const found = await reader.forTask(taskId, {
    before: before ?? null,
    limit: PAGE_SIZE + 1,
    excluding: REORDER_ACTIONS,
  })
  const entries = found.slice(0, PAGE_SIZE)
  const causeIds = entries.flatMap((entry) =>
    entry.causationId ? [entry.causationId] : []
  )
  const causes = new Map(
    (await reader.byIds(causeIds)).map((cause) => [cause.id, cause])
  )
  const ids = new Set(
    [...entries, ...causes.values()].flatMap((entry) => namedIds(entry))
  )

  return ok({
    entries: entries.map((entry) => ({
      ...entry,
      cause: (entry.causationId && causes.get(entry.causationId)) || null,
    })),
    names: await reader.names([...ids]),
    olderBefore:
      found.length > PAGE_SIZE
        ? (entries[entries.length - 1]?.id ?? null)
        : null,
  })
}
