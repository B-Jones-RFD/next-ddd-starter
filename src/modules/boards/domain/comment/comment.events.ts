import type { BoardId } from '@/modules/boards/domain/board/board-id'
import type { CommentId } from '@/modules/boards/domain/comment/comment-id'
import type { TaskId } from '@/modules/boards/domain/task/task-id'
import type { DomainEvent } from '@/shared/kernel/events'

/**
 * A Board member commented on a task. Translated to `boards.CommentAdded.v1`,
 * which carries the text so audit can show it in Activity.
 */
export type CommentAdded = DomainEvent<
  'CommentAdded',
  { commentId: CommentId; taskId: TaskId; boardId: BoardId; text: string }
>

export type CommentEvent = CommentAdded
