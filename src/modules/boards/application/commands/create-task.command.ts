import { z } from 'zod'

import { getInjection } from '@/di/container'
import { roleOf } from '@/modules/boards/domain/board/board'
import type { ListArchivedError } from '@/modules/boards/domain/list/list.errors'
import { toListId } from '@/modules/boards/domain/list/list-id'
import { createTask as createTaskOperation } from '@/modules/boards/domain/task/task'
import { toTaskId } from '@/modules/boards/domain/task/task-id'
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

const CreateTaskInput = z.object({
  actorId: z.string().min(1),
  listId: z.string().min(1),
  title: z.string(),
})

export type CreateTaskInput = {
  actorId: UserId
  listId: string
  title: string
}

/** A Board member adds a task to the end of an active list. */
export async function createTask(
  input: CreateTaskInput
): Promise<
  Result<
    { taskId: string },
    | ValidationError
    | NotFoundError
    | ForbiddenError
    | ListArchivedError
    | ConflictError
  >
> {
  const shape = CreateTaskInput.safeParse(input)
  if (!shape.success) {
    return err(ValidationError.fromShape(input, shape.error.issues))
  }

  // Read-checks of the list and the actor's membership, outside the task's
  // transaction (§3).
  const lists = await getInjection('IListRepository')
  const list = await lists.findById(toListId(shape.data.listId))
  if (!list.ok) return list
  const boards = await getInjection('IBoardRepository')
  const board = await boards.findById(list.value.boardId)
  if (!board.ok) return board
  const tasks = await getInjection('ITaskRepository')
  const last = await tasks.findLastInList(list.value.id)

  const ids = await getInjection('IIdGenerator')
  const created = createTaskOperation({
    id: toTaskId(ids.next()),
    list: list.value,
    membership: roleOf(board.value, input.actorId),
    title: shape.data.title,
    after: last?.position ?? null,
    now: new Date(),
  })
  if (!created.ok) return created

  const saved = await tasks.save(created.value.state, created.value.events, {
    actorId: input.actorId,
    causationId: null,
  })
  return saved.ok ? ok({ taskId: saved.value.id }) : saved
}
