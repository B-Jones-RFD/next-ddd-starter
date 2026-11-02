import { z } from 'zod'

import { getInjection } from '@/di/container'
import type { BoardSummaryDto } from '@/modules/boards/application/dto/board-summary.dto'
import type { View } from '@/modules/boards/application/ports/board-reader.port'
import { ValidationError } from '@/shared/kernel/errors/domain-error'
import { err, ok, type Result } from '@/shared/kernel/result'
import type { UserId } from '@/shared/kernel/user-id'

// #region list-boards
const ListBoardsInput = z.object({
  actorId: z.string().min(1),
  view: z.enum(['active', 'archived']).default('active'),
})

/**
 * The boards in `view` (default `active`) the actor is a Board member of, by
 * name, with their members.
 */
export async function listBoards(input: {
  actorId: UserId
  view?: View
}): Promise<Result<BoardSummaryDto[], ValidationError>> {
  const shape = ListBoardsInput.safeParse(input)
  if (!shape.success) {
    return err(ValidationError.fromShape(input, shape.error.issues))
  }
  const boards = await getInjection('IBoardReader')
  return ok(await boards.listForMember(input.actorId, shape.data.view))
}
// #endregion list-boards
