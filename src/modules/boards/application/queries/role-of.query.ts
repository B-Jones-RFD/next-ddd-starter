import { z } from 'zod'

import { getInjection } from '@/di/container'
import { ValidationError } from '@/shared/kernel/errors/domain-error'
import { err, ok, type Result } from '@/shared/kernel/result'
import type { UserId } from '@/shared/kernel/user-id'

const RoleOfInput = z.object({
  boardId: z.string().min(1),
  userId: z.string().min(1),
})

/**
 * `userId`'s role on the board, or null if they aren't a Board member of it
 * (or there is no such board). Other contexts ask it before showing a board's
 * data to `userId`, as audit does for Activity and the Board log. It reveals
 * only that one user's own role, so it takes no separate actor.
 */
export async function roleOf(input: {
  boardId: string
  userId: UserId
}): Promise<Result<'owner' | 'member' | null, ValidationError>> {
  const shape = RoleOfInput.safeParse(input)
  if (!shape.success) {
    return err(ValidationError.fromShape(input, shape.error.issues))
  }
  const boards = await getInjection('IBoardReader')
  return ok(await boards.roleOf(shape.data.boardId, input.userId))
}
