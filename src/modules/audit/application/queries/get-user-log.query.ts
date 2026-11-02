import { z } from 'zod'

import { getInjection } from '@/di/container'
import type { LogPageDto } from '@/modules/audit/application/dto/activity.dto'
import {
  pageRequest,
  toPage,
} from '@/modules/audit/application/pages/entry-pages'
import { ValidationError } from '@/shared/kernel/errors/domain-error'
import { err, ok, type Result } from '@/shared/kernel/result'
import type { UserId } from '@/shared/kernel/user-id'

const GetUserLogInput = z.object({
  actorId: z.string().min(1),
  before: z.string().min(1).optional(),
})

export type GetUserLogInput = {
  actorId: UserId
  /** The `olderBefore` of the page before; leave out for the newest page. */
  before?: string
}

/**
 * The actor's own User log: their sign-ins, sign-outs and account changes,
 * newest first, 50 a page. It reads only entries about the actor, so no
 * one can read another user's. A user is never reordered, so there is
 * nothing to hide.
 */
export async function getUserLog(
  input: GetUserLogInput
): Promise<Result<LogPageDto, ValidationError>> {
  const shape = GetUserLogInput.safeParse(input)
  if (!shape.success) {
    return err(ValidationError.fromShape(input, shape.error.issues))
  }
  const reader = await getInjection('IActivityReader')
  const found = await reader.forUser(
    input.actorId,
    pageRequest({ before: shape.data.before, includeReorders: true })
  )
  return ok(await toPage(reader, found))
}
