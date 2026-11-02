import { z } from 'zod'

import { getInjection } from '@/di/container'
import type { BoardArchivedError } from '@/modules/boards/domain/board/board.errors'
import { addMember as addMemberOperation } from '@/modules/boards/domain/board/board'
import type { AlreadyAMemberError } from '@/modules/boards/domain/board/board.errors'
import { toBoardId } from '@/modules/boards/domain/board/board-id'
import type {
  ConflictError,
  NotFoundError,
} from '@/shared/kernel/errors/app-error'
import type { ForbiddenError } from '@/shared/kernel/errors/domain-error'
import { ValidationError } from '@/shared/kernel/errors/domain-error'
import { err, ok, type Result } from '@/shared/kernel/result'
import { toUserId, type UserId } from '@/shared/kernel/user-id'

const AddMemberInput = z.object({
  actorId: z.string().min(1),
  boardId: z.string().min(1),
  userId: z.string().min(1),
})

export type AddMemberInput = {
  actorId: UserId
  boardId: string
  userId: string
}

/**
 * The board's Owner adds a registered user as a Member. `NotFoundError` for
 * a user boards hasn't heard of, read from its people projection.
 */
export async function addMember(
  input: AddMemberInput
): Promise<
  Result<
    void,
    | ValidationError
    | NotFoundError
    | ForbiddenError
    | BoardArchivedError
    | AlreadyAMemberError
    | ConflictError
  >
> {
  const shape = AddMemberInput.safeParse(input)
  if (!shape.success) {
    return err(ValidationError.fromShape(input, shape.error.issues))
  }

  const boards = await getInjection('IBoardRepository')
  const board = await boards.findById(toBoardId(shape.data.boardId))
  if (!board.ok) return board

  const people = await getInjection('IPeopleProjection')
  const person = await people.find(toUserId(shape.data.userId))
  if (!person.ok) return person

  const added = addMemberOperation(
    board.value,
    input.actorId,
    person.value.userId
  )
  if (!added.ok) return added

  const saved = await boards.save(added.value.state, added.value.events, {
    actorId: input.actorId,
    causationId: null,
  })
  return saved.ok ? ok(undefined) : saved
}
