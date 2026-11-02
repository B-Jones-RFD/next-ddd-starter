import {
  mayChange,
  membershipOn,
  tagOn,
  type Board,
} from '@/modules/boards/domain/board/board'
import type { BoardArchivedError } from '@/modules/boards/domain/board/board.errors'
import type { TagId } from '@/modules/boards/domain/board/tag'
import {
  attachTag,
  detachTag,
  type Task,
} from '@/modules/boards/domain/task/task'
import { TaskArchivedError } from '@/modules/boards/domain/task/task.errors'
import type { TaskEvent } from '@/modules/boards/domain/task/task.events'
import { NotFoundError } from '@/shared/kernel/errors/app-error'
import type { ForbiddenError } from '@/shared/kernel/errors/domain-error'
import { err, ok, type Result } from '@/shared/kernel/result'
import type { UserId } from '@/shared/kernel/user-id'

type Change = { state: Task; events: TaskEvent[] }

/**
 * The actor's membership and the tag, both read from the task's board,
 * loaded outside the task's transaction (§3). A tag on another board isn't
 * found, so tags stay per board, and an archived task or board is read-only.
 */
function checked(
  task: Task,
  board: Board,
  actorId: UserId,
  tagId: TagId
): Result<
  void,
  ForbiddenError | BoardArchivedError | TaskArchivedError | NotFoundError
> {
  if (board.id !== task.boardId) return err(new NotFoundError('Tag', tagId))
  const allowed = mayChange(membershipOn(board, actorId))
  if (!allowed.ok) return allowed
  if (task.archived) return err(new TaskArchivedError())
  if (!tagOn(board, tagId)) return err(new NotFoundError('Tag', tagId))
  return ok(undefined)
}

/**
 * A Board member attaches one of the board's tags to a task. Only the task
 * is written. A tag deleted meanwhile is a race we accept (§13): its
 * Consequence strips it again.
 */
export function tagTask(
  task: Task,
  board: Board,
  actorId: UserId,
  tagId: TagId
): Result<
  Change,
  ForbiddenError | BoardArchivedError | TaskArchivedError | NotFoundError
> {
  const allowed = checked(task, board, actorId, tagId)
  if (!allowed.ok) return allowed
  return ok(attachTag(task, tagId))
}

/** A Board member detaches one of the board's tags from a task. */
export function untagTask(
  task: Task,
  board: Board,
  actorId: UserId,
  tagId: TagId
): Result<
  Change,
  ForbiddenError | BoardArchivedError | TaskArchivedError | NotFoundError
> {
  const allowed = checked(task, board, actorId, tagId)
  if (!allowed.ok) return allowed
  return ok(detachTag(task, tagId))
}
