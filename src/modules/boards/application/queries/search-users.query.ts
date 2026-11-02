import { z } from 'zod'

import { getInjection } from '@/di/container'
import type { UserSearchResultDto } from '@/modules/boards/application/dto/user-search-result.dto'
import type { NotFoundError } from '@/shared/kernel/errors/app-error'
import {
  ForbiddenError,
  ValidationError,
} from '@/shared/kernel/errors/domain-error'
import { err, ok, type Result } from '@/shared/kernel/result'
import type { UserId } from '@/shared/kernel/user-id'

const SearchUsersInput = z.object({
  actorId: z.string().min(1),
  boardId: z.string().min(1),
  email: z.string(),
})

/**
 * The registered users with this email, at most one, for the board's Owner
 * to add. `ForbiddenError` for anyone else, read through the actor's own
 * membership, and `NotFoundError` if there is no such board.
 */
export async function searchUsers(input: {
  actorId: UserId
  boardId: string
  email: string
}): Promise<
  Result<
    UserSearchResultDto[],
    ValidationError | NotFoundError | ForbiddenError
  >
> {
  const shape = SearchUsersInput.safeParse(input)
  if (!shape.success) {
    return err(ValidationError.fromShape(input, shape.error.issues))
  }

  const boards = await getInjection('IBoardReader')
  const board = await boards.getForMember(
    shape.data.boardId,
    input.actorId,
    'active'
  )
  if (!board.ok) return board
  if (board.value.role !== 'owner') return err(new ForbiddenError())

  const directory = await getInjection('IUserDirectory')
  const found = await directory.findByEmail(input.actorId, shape.data.email)
  if (!found.ok) return found
  if (!found.value) return ok([])

  const { userId, displayName, email } = found.value
  const isMember = board.value.members.some((m) => m.userId === userId)
  return ok([{ userId, displayName, email, isMember }])
}
