import { z } from 'zod'

import { getInjection } from '@/di/container'
import { renameTag as renameTagOperation } from '@/modules/boards/domain/board/board'
import type { TagNameTakenError } from '@/modules/boards/domain/board/board.errors'
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

const RenameTagInput = z.object({
  actorId: z.string().min(1),
  boardId: z.string().min(1),
  tagId: z.string().min(1),
  name: z.string(),
})

export type RenameTagInput = {
  actorId: UserId
  boardId: string
  tagId: string
  name: string
}

/** A Board member renames one of the board's tags. */
export async function renameTag(
  input: RenameTagInput
): Promise<
  Result<
    void,
    | ValidationError
    | NotFoundError
    | ForbiddenError
    | TagNameTakenError
    | ConflictError
  >
> {
  const shape = RenameTagInput.safeParse(input)
  if (!shape.success) {
    return err(ValidationError.fromShape(input, shape.error.issues))
  }

  const boards = await getInjection('IBoardRepository')
  const board = await boards.findById(toBoardId(shape.data.boardId))
  if (!board.ok) return board

  const renamed = renameTagOperation(
    board.value,
    input.actorId,
    toTagId(shape.data.tagId),
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
