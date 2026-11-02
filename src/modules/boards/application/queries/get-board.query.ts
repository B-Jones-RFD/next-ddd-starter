import { z } from 'zod'

import { getInjection } from '@/di/container'
import type { BoardDto } from '@/modules/boards/application/dto/board.dto'
import type { NotFoundError } from '@/shared/kernel/errors/app-error'
import {
  type ForbiddenError,
  ValidationError,
} from '@/shared/kernel/errors/domain-error'
import { err, type Result } from '@/shared/kernel/result'
import type { UserId } from '@/shared/kernel/user-id'

const GetBoardInput = z.object({
  actorId: z.string().min(1),
  boardId: z.string().min(1),
})

/**
 * One board, for a Board member of it. `ForbiddenError` for anyone else, and
 * `NotFoundError` if there is no such board.
 */
export async function getBoard(input: {
  actorId: UserId
  boardId: string
}): Promise<
  Result<BoardDto, ValidationError | NotFoundError | ForbiddenError>
> {
  const shape = GetBoardInput.safeParse(input)
  if (!shape.success) {
    return err(ValidationError.fromShape(input, shape.error.issues))
  }
  const boards = await getInjection('IBoardReader')
  return boards.getForMember(shape.data.boardId, input.actorId)
}
