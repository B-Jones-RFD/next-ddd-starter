import { z } from 'zod'

import { getInjection } from '@/di/container'
import type { BoardDto } from '@/modules/boards/application/dto/board.dto'
import type { View } from '@/modules/boards/application/ports/board-reader.port'
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
  view: z.enum(['active', 'archived']).default('active'),
})

/**
 * One board, archived or not, for a Board member of it, with its lists and
 * tasks in `view` (default `active`). `ForbiddenError` for anyone else, and
 * `NotFoundError` if there is no such board.
 */
export async function getBoard(input: {
  actorId: UserId
  boardId: string
  view?: View
}): Promise<
  Result<BoardDto, ValidationError | NotFoundError | ForbiddenError>
> {
  const shape = GetBoardInput.safeParse(input)
  if (!shape.success) {
    return err(ValidationError.fromShape(input, shape.error.issues))
  }
  const boards = await getInjection('IBoardReader')
  return boards.getForMember(shape.data.boardId, input.actorId, shape.data.view)
}
