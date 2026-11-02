import { z } from 'zod'

import { getInjection } from '@/di/container'
import { ValidationError } from '@/shared/kernel/errors/domain-error'
import { err, ok, type Result } from '@/shared/kernel/result'
import type { UserId } from '@/shared/kernel/user-id'

const RoleOfInput = z.object({
  actorId: z.string().min(1),
  boardId: z.string().min(1),
})

/**
 * The actor's own role on the board, or null if they aren't a Board member
 * of it (or there is no such board). Other contexts ask it before showing a
 * board's data to the actor, as audit does for Activity and the Board log.
 * It answers only for the actor, so nobody learns another user's role.
 */
export async function roleOf(input: {
  actorId: UserId
  boardId: string
}): Promise<Result<'owner' | 'member' | null, ValidationError>> {
  const shape = RoleOfInput.safeParse(input)
  if (!shape.success) {
    return err(ValidationError.fromShape(input, shape.error.issues))
  }
  const boards = await getInjection('IBoardReader')
  return ok(await boards.roleOf(shape.data.boardId, input.actorId))
}
