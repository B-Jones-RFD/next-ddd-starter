import { z } from 'zod'

import { getInjection } from '@/di/container'
import type { BoardArchivedError } from '@/modules/boards/domain/board/board.errors'
import { removeMember as removeMemberOperation } from '@/modules/boards/domain/board/board'
import type {
  NotAMemberError,
  OwnerMustTransferFirstError,
} from '@/modules/boards/domain/board/board.errors'
import { toBoardId } from '@/modules/boards/domain/board/board-id'
import type {
  ConflictError,
  NotFoundError,
} from '@/shared/kernel/errors/app-error'
import type { ForbiddenError } from '@/shared/kernel/errors/domain-error'
import { ValidationError } from '@/shared/kernel/errors/domain-error'
import { err, ok, type Result } from '@/shared/kernel/result'
import { toUserId, type UserId } from '@/shared/kernel/user-id'

const RemoveMemberInput = z.object({
  actorId: z.string().min(1),
  boardId: z.string().min(1),
  userId: z.string().min(1),
})

export type RemoveMemberInput = {
  actorId: UserId
  boardId: string
  userId: string
}

/** The board's Owner removes a Member, who loses access at once. */
export async function removeMember(
  input: RemoveMemberInput
): Promise<
  Result<
    void,
    | ValidationError
    | NotFoundError
    | ForbiddenError
    | BoardArchivedError
    | NotAMemberError
    | OwnerMustTransferFirstError
    | ConflictError
  >
> {
  const shape = RemoveMemberInput.safeParse(input)
  if (!shape.success) {
    return err(ValidationError.fromShape(input, shape.error.issues))
  }

  const boards = await getInjection('IBoardRepository')
  const board = await boards.findById(toBoardId(shape.data.boardId))
  if (!board.ok) return board

  const removed = removeMemberOperation(
    board.value,
    input.actorId,
    toUserId(shape.data.userId)
  )
  if (!removed.ok) return removed

  const saved = await boards.save(removed.value.state, removed.value.events, {
    actorId: input.actorId,
    causationId: null,
  })
  return saved.ok ? ok(undefined) : saved
}
