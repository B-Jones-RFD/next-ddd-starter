import { z } from 'zod'

import { getInjection } from '@/di/container'
import { transferOwnership as transferOwnershipOperation } from '@/modules/boards/domain/board/board'
import type { NotAMemberError } from '@/modules/boards/domain/board/board.errors'
import { toBoardId } from '@/modules/boards/domain/board/board-id'
import type {
  ConflictError,
  NotFoundError,
} from '@/shared/kernel/errors/app-error'
import type { ForbiddenError } from '@/shared/kernel/errors/domain-error'
import { ValidationError } from '@/shared/kernel/errors/domain-error'
import { err, ok, type Result } from '@/shared/kernel/result'
import { toUserId, type UserId } from '@/shared/kernel/user-id'

const TransferOwnershipInput = z.object({
  actorId: z.string().min(1),
  boardId: z.string().min(1),
  userId: z.string().min(1),
})

export type TransferOwnershipInput = {
  actorId: UserId
  boardId: string
  /** The Board member who becomes the Owner. */
  userId: string
}

/** The Owner makes another Board member the Owner, and becomes a Member. */
export async function transferOwnership(
  input: TransferOwnershipInput
): Promise<
  Result<
    void,
    | ValidationError
    | NotFoundError
    | ForbiddenError
    | NotAMemberError
    | ConflictError
  >
> {
  const shape = TransferOwnershipInput.safeParse(input)
  if (!shape.success) {
    return err(ValidationError.fromShape(input, shape.error.issues))
  }

  const boards = await getInjection('IBoardRepository')
  const board = await boards.findById(toBoardId(shape.data.boardId))
  if (!board.ok) return board

  const transferred = transferOwnershipOperation(
    board.value,
    input.actorId,
    toUserId(shape.data.userId)
  )
  if (!transferred.ok) return transferred
  if (transferred.value.events.length === 0) return ok(undefined)

  const saved = await boards.save(
    transferred.value.state,
    transferred.value.events,
    { actorId: input.actorId, causationId: null }
  )
  return saved.ok ? ok(undefined) : saved
}
