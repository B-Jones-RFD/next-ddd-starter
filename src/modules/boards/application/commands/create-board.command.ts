import { z } from 'zod'

import { getInjection } from '@/di/container'
import { createBoard as createBoardOperation } from '@/modules/boards/domain/board/board'
import { toBoardId } from '@/modules/boards/domain/board/board-id'
import type { ConflictError } from '@/shared/kernel/errors/app-error'
import { ValidationError } from '@/shared/kernel/errors/domain-error'
import { err, ok, type Result } from '@/shared/kernel/result'
import type { UserId } from '@/shared/kernel/user-id'

const CreateBoardInput = z.object({
  actorId: z.string().min(1),
  name: z.string(),
})

export type CreateBoardInput = { actorId: UserId; name: string }

/** The actor creates a board and becomes its Owner. */
export async function createBoard(
  input: CreateBoardInput
): Promise<Result<{ boardId: string }, ValidationError | ConflictError>> {
  const shape = CreateBoardInput.safeParse(input)
  if (!shape.success) {
    return err(ValidationError.fromShape(input, shape.error.issues))
  }

  const ids = await getInjection('IIdGenerator')
  const created = createBoardOperation({
    id: toBoardId(ids.next()),
    actorId: input.actorId,
    name: shape.data.name,
    now: new Date(),
  })
  if (!created.ok) return created

  const boards = await getInjection('IBoardRepository')
  const saved = await boards.save(created.value.state, created.value.events, {
    actorId: input.actorId,
    causationId: null,
  })
  return saved.ok ? ok({ boardId: saved.value.id }) : saved
}
