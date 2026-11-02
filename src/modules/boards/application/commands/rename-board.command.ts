import { z } from 'zod'

import { getInjection } from '@/di/container'
import { renameBoard as renameBoardOperation } from '@/modules/boards/domain/board/board'
import { toBoardId } from '@/modules/boards/domain/board/board-id'
import type {
  ConflictError,
  NotFoundError,
} from '@/shared/kernel/errors/app-error'
import type { ForbiddenError } from '@/shared/kernel/errors/domain-error'
import { ValidationError } from '@/shared/kernel/errors/domain-error'
import { err, ok, type Result } from '@/shared/kernel/result'
import type { UserId } from '@/shared/kernel/user-id'

const RenameBoardInput = z.object({
  actorId: z.string().min(1),
  boardId: z.string().min(1),
  name: z.string(),
})

export type RenameBoardInput = {
  actorId: UserId
  boardId: string
  name: string
}

/** The board's Owner renames it. */
export async function renameBoard(
  input: RenameBoardInput
): Promise<
  Result<void, ValidationError | NotFoundError | ForbiddenError | ConflictError>
> {
  const shape = RenameBoardInput.safeParse(input)
  if (!shape.success) {
    return err(ValidationError.fromShape(input, shape.error.issues))
  }

  const boards = await getInjection('IBoardRepository')
  const board = await boards.findById(toBoardId(shape.data.boardId))
  if (!board.ok) return board

  const renamed = renameBoardOperation(
    board.value,
    input.actorId,
    shape.data.name
  )
  if (!renamed.ok) return renamed
  if (renamed.value.events.length === 0) return ok(undefined)

  const saved = await boards.save(renamed.value.state, renamed.value.events, {
    actorId: input.actorId,
    causationId: null,
  })
  return saved.ok ? ok(undefined) : saved
}
