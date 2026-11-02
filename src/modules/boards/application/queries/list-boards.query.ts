import { z } from 'zod'

import type { BoardSummaryDto } from '@/modules/boards/application/dto/board-summary.dto'
import { ValidationError } from '@/shared/kernel/errors/domain-error'
import { err, ok, type Result } from '@/shared/kernel/result'
import type { UserId } from '@/shared/kernel/user-id'

const ListBoardsInput = z.object({ actorId: z.string().min(1) })

/**
 * The boards the actor is a Board member of. Boards can't be created yet
 * (slice 4), so this is always empty; the read will filter by membership.
 */
export async function listBoards(input: {
  actorId: UserId
}): Promise<Result<BoardSummaryDto[], ValidationError>> {
  const shape = ListBoardsInput.safeParse(input)
  if (!shape.success) {
    return err(ValidationError.fromShape(input, shape.error.issues))
  }
  return ok([])
}
