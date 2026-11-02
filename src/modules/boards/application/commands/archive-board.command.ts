import { z } from 'zod'

import { getInjection } from '@/di/container'
import { archiveBoard as archiveBoardOperation } from '@/modules/boards/domain/board/board'
import { toBoardId } from '@/modules/boards/domain/board/board-id'
import type { BoardNameMismatchError } from '@/modules/boards/domain/board/board.errors'
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

const ArchiveBoardInput = z.object({
  actorId: z.string().min(1),
  boardId: z.string().min(1),
  confirmName: z.string().min(1),
})

export type ArchiveBoardInput = {
  actorId: UserId
  boardId: string
  /** The board's name, typed by the Owner to confirm. */
  confirmName: string
}

/**
 * The Owner archives the board, confirming by typing its name. Its lists and
 * tasks are untouched: archiving never cascades.
 */
export async function archiveBoard(
  input: ArchiveBoardInput
): Promise<
  Result<
    void,
    | ValidationError
    | NotFoundError
    | ForbiddenError
    | BoardNameMismatchError
    | ConflictError
  >
> {
  const shape = ArchiveBoardInput.safeParse(input)
  if (!shape.success) {
    return err(ValidationError.fromShape(input, shape.error.issues))
  }

  const boards = await getInjection('IBoardRepository')
  const board = await boards.findById(toBoardId(shape.data.boardId))
  if (!board.ok) return board

  const changed = archiveBoardOperation(
    board.value,
    input.actorId,
    shape.data.confirmName
  )
  if (!changed.ok) return changed
  if (changed.value.events.length === 0) return ok(undefined)

  const saved = await boards.save(changed.value.state, changed.value.events, {
    actorId: input.actorId,
    causationId: null,
  })
  return saved.ok ? ok(undefined) : saved
}
