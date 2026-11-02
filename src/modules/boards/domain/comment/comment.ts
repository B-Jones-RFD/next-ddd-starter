import type { BoardId } from '@/modules/boards/domain/board/board-id'
import type { CommentId } from '@/modules/boards/domain/comment/comment-id'
import {
  parseCommentText,
  type CommentText,
} from '@/modules/boards/domain/comment/comment-text'
import type { CommentEvent } from '@/modules/boards/domain/comment/comment.events'
import type { Membership } from '@/modules/boards/domain/list/list'
import type { Task } from '@/modules/boards/domain/task/task'
import type { TaskId } from '@/modules/boards/domain/task/task-id'
import { TaskArchivedError } from '@/modules/boards/domain/task/task.errors'
import {
  ForbiddenError,
  type ValidationError,
} from '@/shared/kernel/errors/domain-error'
import { err, ok, type Result } from '@/shared/kernel/result'
import type { UserId } from '@/shared/kernel/user-id'

/** Free text a Board member writes on a task, with its author and time. */
export type Comment = {
  readonly id: CommentId
  readonly taskId: TaskId
  /** The task's board, so the comment is filed without a lookup. */
  readonly boardId: BoardId
  readonly authorId: UserId
  readonly text: CommentText
  readonly createdAt: Date
  /** Owned by persistence: 0 until first saved (§5). */
  readonly version: number
}

type Change = { state: Comment; events: CommentEvent[] }

// #region add-comment
/** A Board member comments on an active task. */
export function addComment(input: {
  id: CommentId
  /** The task it is on, loaded as a read-check (§3). */
  task: Task
  membership: Membership
  authorId: UserId
  text: string
  now: Date
}): Result<Change, ValidationError | ForbiddenError | TaskArchivedError> {
  if (!input.membership) return err(new ForbiddenError())
  if (input.task.archived) return err(new TaskArchivedError())
  const text = parseCommentText(input.text)
  if (!text.ok) return text
  const state: Comment = {
    id: input.id,
    taskId: input.task.id,
    boardId: input.task.boardId,
    authorId: input.authorId,
    text: text.value,
    createdAt: input.now,
    version: 0,
  }
  return ok({
    state,
    events: [
      {
        type: 'CommentAdded',
        payload: {
          commentId: state.id,
          taskId: state.taskId,
          boardId: state.boardId,
          text: state.text,
        },
      },
    ],
  })
}
// #endregion add-comment
