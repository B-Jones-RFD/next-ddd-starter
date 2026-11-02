import { z } from 'zod'

import { getInjection } from '@/di/container'
import { roleOf } from '@/modules/boards/domain/board/board'
import { addComment as addCommentOperation } from '@/modules/boards/domain/comment/comment'
import { toCommentId } from '@/modules/boards/domain/comment/comment-id'
import type { TaskArchivedError } from '@/modules/boards/domain/task/task.errors'
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

const AddCommentInput = z.object({
  actorId: z.string().min(1),
  taskId: z.string().min(1),
  text: z.string(),
})

export type AddCommentInput = {
  actorId: UserId
  taskId: string
  text: string
}

// #region add-comment-command
/**
 * A Board member comments on an active task. The comment reaches the task's
 * Activity one relay drain later, through `boards.CommentAdded.v1`.
 */
export async function addComment(
  input: AddCommentInput
): Promise<
  Result<
    { commentId: string },
    | ValidationError
    | NotFoundError
    | ForbiddenError
    | TaskArchivedError
    | ConflictError
  >
> {
  const shape = AddCommentInput.safeParse(input)
  if (!shape.success) {
    return err(ValidationError.fromShape(input, shape.error.issues))
  }

  // Read-checks of the task and the actor's membership, outside the
  // comment's transaction (§3).
  const tasks = await getInjection('ITaskRepository')
  const task = await tasks.findById(toTaskId(shape.data.taskId))
  if (!task.ok) return task
  const boards = await getInjection('IBoardRepository')
  const board = await boards.findById(task.value.boardId)
  if (!board.ok) return board

  const ids = await getInjection('IIdGenerator')
  const added = addCommentOperation({
    id: toCommentId(ids.next()),
    task: task.value,
    membership: roleOf(board.value, input.actorId),
    authorId: input.actorId,
    text: shape.data.text,
    now: new Date(),
  })
  if (!added.ok) return added

  const comments = await getInjection('ICommentRepository')
  const saved = await comments.save(added.value.state, added.value.events, {
    actorId: input.actorId,
    causationId: null,
  })
  return saved.ok ? ok({ commentId: saved.value.id }) : saved
}
// #endregion add-comment-command
