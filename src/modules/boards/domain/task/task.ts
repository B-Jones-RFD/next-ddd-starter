import type { BoardId } from '@/modules/boards/domain/board/board-id'
import {
  acceptTasks,
  type List,
  type Membership,
} from '@/modules/boards/domain/list/list'
import type { ListArchivedError } from '@/modules/boards/domain/list/list.errors'
import type { ListId } from '@/modules/boards/domain/list/list-id'
import {
  parseTaskDescription,
  type TaskDescription,
} from '@/modules/boards/domain/task/task-description'
import type { TaskId } from '@/modules/boards/domain/task/task-id'
import {
  parseTaskTitle,
  type TaskTitle,
} from '@/modules/boards/domain/task/task-title'
import { TaskArchivedError } from '@/modules/boards/domain/task/task.errors'
import type { TaskEvent } from '@/modules/boards/domain/task/task.events'
import { ConflictError, NotFoundError } from '@/shared/kernel/errors/app-error'
import {
  ForbiddenError,
  type ValidationError,
} from '@/shared/kernel/errors/domain-error'
import { keyBetween } from '@/shared/kernel/key-between'
import { err, ok, type Result } from '@/shared/kernel/result'

/** A single unit of work on a board, sitting in exactly one list. */
export type Task = {
  readonly id: TaskId
  /** The board never changes: a task moves only between its board's lists. */
  readonly boardId: BoardId
  readonly listId: ListId
  readonly title: TaskTitle
  readonly description: TaskDescription
  /** A fractional key: tasks sort within their list by `(position, id)` (§3). */
  readonly position: string
  readonly archived: boolean
  readonly createdAt: Date
  /** Owned by persistence: 0 until first saved (§5). */
  readonly version: number
}

export type { Membership }

type Change = { state: Task; events: TaskEvent[] }

/** The tasks a task will sit between: give one to put it first or last. */
export type TaskPlace = { after?: Task; before?: Task }

// #region create-task
/** A Board member adds a task to the end of an active list, after `after`. */
export function createTask(input: {
  id: TaskId
  /** The list it goes in, loaded as a read-check (§3). */
  list: List
  membership: Membership
  title: string
  /** The position of the list's last task, or null if it has none. */
  after: string | null
  now: Date
}): Result<Change, ValidationError | ForbiddenError | ListArchivedError> {
  if (!input.membership) return err(new ForbiddenError())
  const list = acceptTasks(input.list)
  if (!list.ok) return list
  const title = parseTaskTitle(input.title)
  if (!title.ok) return title
  const state: Task = {
    id: input.id,
    boardId: list.value.boardId,
    listId: list.value.id,
    title: title.value,
    description: '' as TaskDescription,
    position: keyBetween(input.after, null),
    archived: false,
    createdAt: input.now,
    version: 0,
  }
  return ok({
    state,
    events: [
      {
        type: 'TaskCreated',
        payload: {
          taskId: state.id,
          boardId: state.boardId,
          listId: state.listId,
          title: state.title,
        },
      },
    ],
  })
}
// #endregion create-task

// #region rename-task
/** A Board member renames a task. The same title raises nothing. */
export function renameTask(
  task: Task,
  membership: Membership,
  rawTitle: string
): Result<Change, ValidationError | ForbiddenError | TaskArchivedError> {
  if (!membership) return err(new ForbiddenError())
  if (task.archived) return err(new TaskArchivedError())
  const title = parseTaskTitle(rawTitle)
  if (!title.ok) return title
  if (title.value === task.title) return ok({ state: task, events: [] })
  return ok({
    state: { ...task, title: title.value },
    events: [
      {
        type: 'TaskRenamed',
        payload: {
          taskId: task.id,
          boardId: task.boardId,
          from: task.title,
          to: title.value,
        },
      },
    ],
  })
}
// #endregion rename-task

/**
 * A Board member changes a task's description, or clears it. The same
 * description raises nothing.
 */
export function changeTaskDescription(
  task: Task,
  membership: Membership,
  rawDescription: string
): Result<Change, ValidationError | ForbiddenError | TaskArchivedError> {
  if (!membership) return err(new ForbiddenError())
  if (task.archived) return err(new TaskArchivedError())
  const description = parseTaskDescription(rawDescription)
  if (!description.ok) return description
  if (description.value === task.description) {
    return ok({ state: task, events: [] })
  }
  return ok({
    state: { ...task, description: description.value },
    events: [
      {
        type: 'TaskDescriptionChanged',
        payload: {
          taskId: task.id,
          boardId: task.boardId,
          from: task.description,
          to: description.value,
        },
      },
    ],
  })
}

/**
 * A Board member moves a task to another place in its own list, between the
 * tasks that will be its neighbours. Only the moved task changes.
 */
export function reorderTask(
  task: Task,
  membership: Membership,
  place: TaskPlace
): Result<
  Change,
  ForbiddenError | TaskArchivedError | NotFoundError | ConflictError
> {
  if (!membership) return err(new ForbiddenError())
  if (task.archived) return err(new TaskArchivedError())
  if (!place.after && !place.before) return ok({ state: task, events: [] })
  return placeTask(task, task.listId, place)
}

/**
 * Puts the task in list `listId` between `after` and `before`, raising
 * `TaskReordered` within its own list and `TaskMoved` into another. The
 * caller has checked the actor and the list. Neighbours outside the list are
 * not found, and neighbours out of order mean the page was stale.
 */
export function placeTask(
  task: Task,
  listId: ListId,
  { after, before }: TaskPlace
): Result<Change, NotFoundError | ConflictError> {
  for (const neighbour of [after, before]) {
    if (!neighbour) continue
    if (neighbour.listId !== listId) {
      return err(new NotFoundError('Task', neighbour.id))
    }
    if (neighbour.id === task.id) return err(new ConflictError('Task', task.id))
  }
  if (after && before && after.position >= before.position) {
    return err(new ConflictError('Task', task.id))
  }
  const state: Task = {
    ...task,
    listId,
    position: keyBetween(after?.position ?? null, before?.position ?? null),
  }
  const event: TaskEvent =
    listId === task.listId
      ? {
          type: 'TaskReordered',
          payload: { taskId: task.id, boardId: task.boardId, listId },
        }
      : {
          type: 'TaskMoved',
          payload: {
            taskId: task.id,
            boardId: task.boardId,
            fromListId: task.listId,
            toListId: listId,
          },
        }
  return ok({ state, events: [event] })
}

/**
 * A Board member archives a task. It keeps its list and place, so a restore
 * puts it back where it was. Archiving an archived task raises nothing.
 */
export function archiveTask(
  task: Task,
  membership: Membership
): Result<Change, ForbiddenError> {
  if (!membership) return err(new ForbiddenError())
  if (task.archived) return ok({ state: task, events: [] })
  return ok({
    state: { ...task, archived: true },
    events: [
      {
        type: 'TaskArchived',
        payload: {
          taskId: task.id,
          boardId: task.boardId,
          listId: task.listId,
        },
      },
    ],
  })
}
