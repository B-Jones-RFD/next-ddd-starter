import { z } from 'zod'

import { getInjection } from '@/di/container'
import { createTag as createTagOperation } from '@/modules/boards/domain/board/board'
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

const CreateTagInput = z.object({
  actorId: z.string().min(1),
  boardId: z.string().min(1),
  name: z.string(),
  color: z.string(),
})

export type CreateTagInput = {
  actorId: UserId
  boardId: string
  name: string
  /** One of the Tag color names. */
  color: string
}

/** A Board member defines a tag on the board. */
export async function createTag(
  input: CreateTagInput
): Promise<
  Result<
    { tagId: string },
    | ValidationError
    | NotFoundError
    | ForbiddenError
    | TagNameTakenError
    | ConflictError
  >
> {
  const shape = CreateTagInput.safeParse(input)
  if (!shape.success) {
    return err(ValidationError.fromShape(input, shape.error.issues))
  }

  const boards = await getInjection('IBoardRepository')
  const board = await boards.findById(toBoardId(shape.data.boardId))
  if (!board.ok) return board

  const ids = await getInjection('IIdGenerator')
  const tagId = toTagId(ids.next())
  const created = createTagOperation(board.value, input.actorId, {
    id: tagId,
    name: shape.data.name,
    color: shape.data.color,
  })
  if (!created.ok) return created

  const saved = await boards.save(created.value.state, created.value.events, {
    actorId: input.actorId,
    causationId: null,
  })
  return saved.ok ? ok({ tagId }) : saved
}
