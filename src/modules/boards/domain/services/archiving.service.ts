import {
  acceptTasks,
  type List,
  type Membership,
} from '@/modules/boards/domain/list/list'
import {
  type ListArchivedError,
  ListHasActiveTasksError,
} from '@/modules/boards/domain/list/list.errors'
import type { ListEvent } from '@/modules/boards/domain/list/list.events'
import type { Task } from '@/modules/boards/domain/task/task'
import type { TaskEvent } from '@/modules/boards/domain/task/task.events'
import { NotFoundError } from '@/shared/kernel/errors/app-error'
import { ForbiddenError } from '@/shared/kernel/errors/domain-error'
import { err, ok, type Result } from '@/shared/kernel/result'

// Archiving never cascades: a list and its tasks are archived and restored
// one by one. The rules between them are read-checks over aggregates loaded
// outside the transaction, and races between them are accepted (§13).

// #region archive-list
/**
 * A Board member archives a list, in its place, once none of its tasks are
 * active. `tasks` are the list's tasks, loaded as a read-check; any other
 * list's tasks are ignored. Archiving an archived list raises nothing.
 */
export function archiveList(
  list: List,
  membership: Membership,
  tasks: readonly Task[]
): Result<
  { state: List; events: ListEvent[] },
  ForbiddenError | ListHasActiveTasksError
> {
  if (!membership) return err(new ForbiddenError())
  if (list.archived) return ok({ state: list, events: [] })
  if (tasks.some((task) => task.listId === list.id && !task.archived)) {
    return err(new ListHasActiveTasksError())
  }
  return ok({
    state: { ...list, archived: true },
    events: [
      {
        type: 'ListArchived',
        payload: { listId: list.id, boardId: list.boardId },
      },
    ],
  })
}
// #endregion archive-list

/**
 * A Board member restores an archived task, in its old place, into its own
 * list, which must be active: tasks don't reappear in hidden lists.
 * Restoring an active task raises nothing.
 */
export function restoreTask(
  task: Task,
  membership: Membership,
  list: List
): Result<
  { state: Task; events: TaskEvent[] },
  ForbiddenError | NotFoundError | ListArchivedError
> {
  if (!membership) return err(new ForbiddenError())
  if (list.id !== task.listId) return err(new NotFoundError('List', list.id))
  if (!task.archived) return ok({ state: task, events: [] })
  const accepted = acceptTasks(list)
  if (!accepted.ok) return accepted
  return ok({
    state: { ...task, archived: false },
    events: [
      {
        type: 'TaskRestored',
        payload: { taskId: task.id, boardId: task.boardId, listId: list.id },
      },
    ],
  })
}
