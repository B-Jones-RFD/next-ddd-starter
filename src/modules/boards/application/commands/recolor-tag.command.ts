import { z } from 'zod'

import { getInjection } from '@/di/container'
import type { BoardArchivedError } from '@/modules/boards/domain/board/board.errors'
import { recolorTag as recolorTagOperation } from '@/modules/boards/domain/board/board'
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

const RecolorTagInput = z.object({
  actorId: z.string().min(1),
  boardId: z.string().min(1),
  tagId: z.string().min(1),
  color: z.string(),
})

export type RecolorTagInput = {
  actorId: UserId
  boardId: string
  tagId: string
  /** One of the Tag color names. */
  color: string
}

/** A Board member gives one of the board's tags another Tag color. */
export async function recolorTag(
  input: RecolorTagInput
): Promise<
  Result<
    void,
    | ValidationError
    | NotFoundError
    | ForbiddenError
    | BoardArchivedError
    | ConflictError
  >
> {
  const shape = RecolorTagInput.safeParse(input)
  if (!shape.success) {
    return err(ValidationError.fromShape(input, shape.error.issues))
  }

  const boards = await getInjection('IBoardRepository')
  const board = await boards.findById(toBoardId(shape.data.boardId))
  if (!board.ok) return board

  const recolored = recolorTagOperation(
    board.value,
    input.actorId,
    toTagId(shape.data.tagId),
    shape.data.color
  )
  if (!recolored.ok) return recolored
  if (recolored.value.events.length === 0) return ok(undefined)

  const saved = await boards.save(
    recolored.value.state,
    recolored.value.events,
    { actorId: input.actorId, causationId: null }
  )
  return saved.ok ? ok(undefined) : saved
}
