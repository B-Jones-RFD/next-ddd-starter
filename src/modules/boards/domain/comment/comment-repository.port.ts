import type { Comment } from '@/modules/boards/domain/comment/comment'
import type { CommentId } from '@/modules/boards/domain/comment/comment-id'
import type { CommentEvent } from '@/modules/boards/domain/comment/comment.events'
import type {
  ConflictError,
  NotFoundError,
} from '@/shared/kernel/errors/app-error'
import type { EventOrigin } from '@/shared/kernel/events'
import type { Result } from '@/shared/kernel/result'

/** Where comments live. Throws `PersistenceError` on an outage. */
export interface ICommentRepository {
  findById(id: CommentId): Promise<Result<Comment, NotFoundError>>
  /**
   * Writes the comment, its events as `domain` outbox rows and their
   * translations as `integration` rows, in one transaction. Returns the
   * saved comment at its new version, or `ConflictError` if it changed since
   * loading.
   */
  save(
    comment: Comment,
    events: readonly CommentEvent[],
    origin: EventOrigin
  ): Promise<Result<Comment, ConflictError>>
}
