import { acceptTasks, type List } from '@/modules/boards/domain/list/list'
import type { ListArchivedError } from '@/modules/boards/domain/list/list.errors'
import {
  placeTask,
  type Membership,
  type Task,
  type TaskPlace,
} from '@/modules/boards/domain/task/task'
import type { TaskEvent } from '@/modules/boards/domain/task/task.events'
import {
  type ConflictError,
  NotFoundError,
} from '@/shared/kernel/errors/app-error'
import { ForbiddenError } from '@/shared/kernel/errors/domain-error'
import { err, ok, type Result } from '@/shared/kernel/result'

/**
 * A Board member moves a task into `toList`, between `after` and `before`
 * (both in that list), from the task's "Move to list…" picker. The list is a
 * read-check loaded outside the task's transaction, so only the task is
 * written. A list archived meanwhile, or one on another board, refuses it.
 * Races with the list's own changes are accepted (§13).
 */
export function moveTask(
  task: Task,
  membership: Membership,
  place: TaskPlace & { toList: List }
): Result<
  { state: Task; events: TaskEvent[] },
  ForbiddenError | NotFoundError | ConflictError | ListArchivedError
> {
  if (!membership) return err(new ForbiddenError())
  const { toList, after, before } = place
  if (toList.boardId !== task.boardId) {
    return err(new NotFoundError('List', toList.id))
  }
  const accepted = acceptTasks(toList)
  if (!accepted.ok) return accepted
  if (toList.id === task.listId && !after && !before) {
    return ok({ state: task, events: [] })
  }
  return placeTask(task, toList.id, { after, before })
}
