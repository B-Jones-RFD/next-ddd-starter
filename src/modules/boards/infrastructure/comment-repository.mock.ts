import { translateCommentEvents } from '@/modules/boards/application/contracts/translate'
import type { Comment } from '@/modules/boards/domain/comment/comment'
import type { CommentId } from '@/modules/boards/domain/comment/comment-id'
import type { ICommentRepository } from '@/modules/boards/domain/comment/comment-repository.port'
import type { CommentEvent } from '@/modules/boards/domain/comment/comment.events'
import { mockStore } from '@/shared/infrastructure/mock-stores'
import { outboxEntries } from '@/shared/infrastructure/outbox/outbox-entries'
import { ConflictError, NotFoundError } from '@/shared/kernel/errors/app-error'
import type { EventOrigin } from '@/shared/kernel/events'
import type { IOutbox } from '@/shared/kernel/ports/outbox.port'
import { err, ok, type Result } from '@/shared/kernel/result'

function mockComments(): Map<string, Comment> {
  return mockStore('boards.comments', () => new Map<string, Comment>())
}

/** In-memory twin of `CommentRepository`: same version rules. */
export class MockCommentRepository implements ICommentRepository {
  constructor(private readonly outbox: IOutbox) {}

  async findById(id: CommentId): Promise<Result<Comment, NotFoundError>> {
    const comment = mockComments().get(id)
    return comment
      ? ok(structuredClone(comment))
      : err(new NotFoundError('Comment', id))
  }

  async save(
    comment: Comment,
    events: readonly CommentEvent[],
    origin: EventOrigin
  ): Promise<Result<Comment, ConflictError>> {
    const comments = mockComments()
    const stored = comments.get(comment.id)
    const fresh =
      comment.version === 0 ? !stored : stored?.version === comment.version
    if (!fresh) return err(new ConflictError('Comment', comment.id))

    const saved = { ...comment, version: comment.version + 1 }
    comments.set(comment.id, structuredClone(saved))
    this.outbox.append(
      outboxEntries({
        aggregateId: comment.id,
        aggregateVersion: saved.version,
        origin,
        domainEvents: events,
        integrationEvents: translateCommentEvents(events),
      })
    )
    return ok(saved)
  }
}
