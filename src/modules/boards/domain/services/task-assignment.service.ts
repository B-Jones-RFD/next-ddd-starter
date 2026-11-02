import { roleOf, type Board } from '@/modules/boards/domain/board/board'
import { NotAMemberError } from '@/modules/boards/domain/board/board.errors'
import type { Task } from '@/modules/boards/domain/task/task'
import type { TaskEvent } from '@/modules/boards/domain/task/task.events'
import { ForbiddenError } from '@/shared/kernel/errors/domain-error'
import { err, ok, type Result } from '@/shared/kernel/result'
import type { UserId } from '@/shared/kernel/user-id'

type Change = { state: Task; events: TaskEvent[] }

/**
 * A Board member makes `userId` an assignee of the task. The board is a
 * read-check loaded outside the task's transaction: only its Board members
 * can assign, and only its Board members can be assigned. Assigning someone
 * already assigned raises nothing. Races with membership changes are
 * accepted (§13), and the hand-over below cleans up after them.
 */
export function assignTask(
  task: Task,
  board: Board,
  actorId: UserId,
  userId: UserId
): Result<Change, ForbiddenError | NotAMemberError> {
  if (!roleOf(board, actorId)) return err(new ForbiddenError())
  if (!roleOf(board, userId)) return err(new NotAMemberError())
  if (task.assignees.includes(userId)) return ok({ state: task, events: [] })
  return ok({
    state: { ...task, assignees: [...task.assignees, userId] },
    events: [
      {
        type: 'TaskAssigned',
        payload: { taskId: task.id, boardId: task.boardId, userId },
      },
    ],
  })
}

/**
 * A Board member stops `userId` being an assignee of the task. The assignee
 * need not still be a Board member, so a leftover from a race (§13) can
 * always be cleared. Unassigning someone not assigned raises nothing.
 */
export function unassignTask(
  task: Task,
  board: Board,
  actorId: UserId,
  userId: UserId
): Result<Change, ForbiddenError> {
  if (!roleOf(board, actorId)) return err(new ForbiddenError())
  return ok(without(task, userId))
}

/**
 * A consequence of a Board member leaving or being removed: their
 * assignment on the task, archived or not, passes to the board's Owner, who
 * is assigned only if not already (§13). There is no actor check, because a
 * handler makes this change for the user who removed them or left. Someone
 * who is a Board member again by the time it runs keeps their assignment.
 */
export function handOverToOwner(
  task: Task,
  board: Board,
  userId: UserId
): Change {
  if (roleOf(board, userId)) return { state: task, events: [] }
  const removed = without(task, userId)
  const owner = board.members.find((member) => member.role === 'owner')
  if (removed.events.length === 0 || !owner) return removed
  if (removed.state.assignees.includes(owner.userId)) return removed
  return {
    state: {
      ...removed.state,
      assignees: [...removed.state.assignees, owner.userId],
    },
    events: [
      ...removed.events,
      {
        type: 'TaskAssigned',
        payload: {
          taskId: task.id,
          boardId: task.boardId,
          userId: owner.userId,
        },
      },
    ],
  }
}

function without(task: Task, userId: UserId): Change {
  if (!task.assignees.includes(userId)) return { state: task, events: [] }
  return {
    state: {
      ...task,
      assignees: task.assignees.filter((assignee) => assignee !== userId),
    },
    events: [
      {
        type: 'TaskUnassigned',
        payload: { taskId: task.id, boardId: task.boardId, userId },
      },
    ],
  }
}
