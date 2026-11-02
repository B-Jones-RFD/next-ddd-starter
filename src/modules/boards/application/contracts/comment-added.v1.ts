import type { CommentAdded } from '@/modules/boards/domain/comment/comment.events'
import type { IntegrationEvent } from '@/shared/kernel/events'

/**
 * `boards.CommentAdded.v1`: a Board member commented `text` on a task. The
 * text travels with the event, so audit shows it in Activity (ADR 0010).
 */
export type CommentAddedV1 = IntegrationEvent<
  'boards.CommentAdded',
  { commentId: string; taskId: string; boardId: string; text: string }
>

export function toCommentAddedV1(event: CommentAdded): CommentAddedV1 {
  return {
    type: 'boards.CommentAdded',
    version: 1,
    payload: {
      commentId: event.payload.commentId,
      taskId: event.payload.taskId,
      boardId: event.payload.boardId,
      text: event.payload.text,
    },
  }
}
