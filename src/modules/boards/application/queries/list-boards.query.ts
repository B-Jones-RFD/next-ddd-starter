import { z } from 'zod'

import { getInjection } from '@/di/container'
import type { BoardSummaryDto } from '@/modules/boards/application/dto/board-summary.dto'
import { ValidationError } from '@/shared/kernel/errors/domain-error'
import { err, ok, type Result } from '@/shared/kernel/result'
import type { UserId } from '@/shared/kernel/user-id'

// #region list-boards
const ListBoardsInput = z.object({ actorId: z.string().min(1) })

/** The boards the actor is a Board member of, by name, with their members. */
export async function listBoards(input: {
  actorId: UserId
}): Promise<Result<BoardSummaryDto[], ValidationError>> {
  const shape = ListBoardsInput.safeParse(input)
  if (!shape.success) {
    return err(ValidationError.fromShape(input, shape.error.issues))
  }
  const boards = await getInjection('IBoardReader')
  return ok(await boards.listForMember(input.actorId))
}
// #endregion list-boards
