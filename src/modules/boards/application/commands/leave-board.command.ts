import { z } from 'zod'

import { getInjection } from '@/di/container'
import type { BoardArchivedError } from '@/modules/boards/domain/board/board.errors'
import { leaveBoard as leaveBoardOperation } from '@/modules/boards/domain/board/board'
import type { OwnerMustTransferFirstError } from '@/modules/boards/domain/board/board.errors'
import { toBoardId } from '@/modules/boards/domain/board/board-id'
import type {
  ConflictError,
  NotFoundError,
} from '@/shared/kernel/errors/app-error'
import type { ForbiddenError } from '@/shared/kernel/errors/domain-error'
import { ValidationError } from '@/shared/kernel/errors/domain-error'
import { err, ok, type Result } from '@/shared/kernel/result'
import type { UserId } from '@/shared/kernel/user-id'

const LeaveBoardInput = z.object({
  actorId: z.string().min(1),
  boardId: z.string().min(1),
})

export type LeaveBoardInput = { actorId: UserId; boardId: string }

/** A Member leaves the board. The Owner must transfer ownership first. */
export async function leaveBoard(
  input: LeaveBoardInput
): Promise<
  Result<
    void,
    | ValidationError
    | NotFoundError
    | ForbiddenError
    | BoardArchivedError
    | OwnerMustTransferFirstError
    | ConflictError
  >
> {
  const shape = LeaveBoardInput.safeParse(input)
  if (!shape.success) {
    return err(ValidationError.fromShape(input, shape.error.issues))
  }

  const boards = await getInjection('IBoardRepository')
  const board = await boards.findById(toBoardId(shape.data.boardId))
  if (!board.ok) return board

  const left = leaveBoardOperation(board.value, input.actorId)
  if (!left.ok) return left

  const saved = await boards.save(left.value.state, left.value.events, {
    actorId: input.actorId,
    causationId: null,
  })
  return saved.ok ? ok(undefined) : saved
}
