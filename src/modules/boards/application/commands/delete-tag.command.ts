import { z } from 'zod'

import { getInjection } from '@/di/container'
import { deleteTag as deleteTagOperation } from '@/modules/boards/domain/board/board'
import { toBoardId } from '@/modules/boards/domain/board/board-id'
import { toTagId } from '@/modules/boards/domain/board/tag'
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

const DeleteTagInput = z.object({
  actorId: z.string().min(1),
  boardId: z.string().min(1),
  tagId: z.string().min(1),
})

export type DeleteTagInput = {
  actorId: UserId
  boardId: string
  tagId: string
}

/**
 * A Board member deletes one of the board's tags. Only the board is written:
 * `boards.untagDeletedTag` strips the tag from its tasks afterwards, one task
 * per transaction (§6).
 */
export async function deleteTag(
  input: DeleteTagInput
): Promise<
  Result<void, ValidationError | NotFoundError | ForbiddenError | ConflictError>
> {
  const shape = DeleteTagInput.safeParse(input)
  if (!shape.success) {
    return err(ValidationError.fromShape(input, shape.error.issues))
  }

  const boards = await getInjection('IBoardRepository')
  const board = await boards.findById(toBoardId(shape.data.boardId))
  if (!board.ok) return board

  const deleted = deleteTagOperation(
    board.value,
    input.actorId,
    toTagId(shape.data.tagId)
  )
  if (!deleted.ok) return deleted

  const saved = await boards.save(deleted.value.state, deleted.value.events, {
    actorId: input.actorId,
    causationId: null,
  })
  return saved.ok ? ok(undefined) : saved
}
