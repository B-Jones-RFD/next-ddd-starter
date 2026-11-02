import { z } from 'zod'

import { getInjection } from '@/di/container'
import { restoreBoard as restoreBoardOperation } from '@/modules/boards/domain/board/board'
import { toBoardId } from '@/modules/boards/domain/board/board-id'
import type {
  ConflictError,
  NotFoundError,
} from '@/shared/kernel/errors/app-error'
import {
  type ForbiddenError,
  ValidationError,
} from '@/shared/kernel/errors/domain-error'
import { err, ok, type Result } from '@/shared/kernel/result'
import type { UserId } from '@/shared/kernel/user-id'

const RestoreBoardInput = z.object({
  actorId: z.string().min(1),
  boardId: z.string().min(1),
})

export type RestoreBoardInput = {
  actorId: UserId
  boardId: string
}

/** The Owner restores an archived board, with its lists and tasks as they were. */
export async function restoreBoard(
  input: RestoreBoardInput
): Promise<
  Result<void, ValidationError | NotFoundError | ForbiddenError | ConflictError>
> {
  const shape = RestoreBoardInput.safeParse(input)
  if (!shape.success) {
    return err(ValidationError.fromShape(input, shape.error.issues))
  }

  const boards = await getInjection('IBoardRepository')
  const board = await boards.findById(toBoardId(shape.data.boardId))
  if (!board.ok) return board

  const changed = restoreBoardOperation(board.value, input.actorId)
  if (!changed.ok) return changed
  if (changed.value.events.length === 0) return ok(undefined)

  const saved = await boards.save(changed.value.state, changed.value.events, {
    actorId: input.actorId,
    causationId: null,
  })
  return saved.ok ? ok(undefined) : saved
}
