import type { DatabaseSync } from 'node:sqlite'

import { translateCommentEvents } from '@/modules/boards/application/contracts/translate'
import type { BoardId } from '@/modules/boards/domain/board/board-id'
import type { Comment } from '@/modules/boards/domain/comment/comment'
import type { CommentId } from '@/modules/boards/domain/comment/comment-id'
import type { CommentText } from '@/modules/boards/domain/comment/comment-text'
import type { ICommentRepository } from '@/modules/boards/domain/comment/comment-repository.port'
import type { CommentEvent } from '@/modules/boards/domain/comment/comment.events'
import type { TaskId } from '@/modules/boards/domain/task/task-id'
import { outboxEntries } from '@/shared/infrastructure/outbox/outbox-entries'
import {
  ROLLBACK,
  transaction,
} from '@/shared/infrastructure/sqlite/transaction'
import { query } from '@/shared/infrastructure/sqlite/translate-error'
import { ConflictError, NotFoundError } from '@/shared/kernel/errors/app-error'
import type { EventOrigin } from '@/shared/kernel/events'
import type { IOutbox } from '@/shared/kernel/ports/outbox.port'
import { err, ok, type Result } from '@/shared/kernel/result'
import type { UserId } from '@/shared/kernel/user-id'

const PORT = 'ICommentRepository'

type CommentRow = {
  id: string
  task_id: string
  board_id: string
  author_id: string
  text: string
  created_at: string
  version: number
}

function toComment(row: CommentRow): Comment {
  return {
    id: row.id as CommentId,
    taskId: row.task_id as TaskId,
    boardId: row.board_id as BoardId,
    authorId: row.author_id as UserId,
    text: row.text as CommentText,
    createdAt: new Date(row.created_at),
    version: row.version,
  }
}

/** Comments in `boards_comments`, one row per comment. */
export class CommentRepository implements ICommentRepository {
  constructor(
    private readonly db: DatabaseSync,
    private readonly outbox: IOutbox
  ) {}

  async findById(id: CommentId): Promise<Result<Comment, NotFoundError>> {
    const row = query(
      PORT,
      () =>
        this.db
          .prepare('SELECT * FROM boards_comments WHERE id = ?')
          .get(id) as CommentRow | undefined
    )
    return row ? ok(toComment(row)) : err(new NotFoundError('Comment', id))
  }

  async save(
    comment: Comment,
    events: readonly CommentEvent[],
    origin: EventOrigin
  ): Promise<Result<Comment, ConflictError>> {
    const version = comment.version + 1
    const entries = outboxEntries({
      aggregateId: comment.id,
      aggregateVersion: version,
      origin,
      domainEvents: events,
      integrationEvents: translateCommentEvents(events),
    })

    const written = transaction(this.db, PORT, () => {
      const { changes } =
        comment.version === 0
          ? this.db
              .prepare(
                `INSERT INTO boards_comments
                   (id, task_id, board_id, author_id, text, created_at,
                    version)
                 VALUES (?, ?, ?, ?, ?, ?, 1)
                 ON CONFLICT DO NOTHING`
              )
              .run(
                comment.id,
                comment.taskId,
                comment.boardId,
                comment.authorId,
                comment.text,
                comment.createdAt.toISOString()
              )
          : this.db
              .prepare(
                `UPDATE boards_comments
                 SET text = ?, version = version + 1
                 WHERE id = ? AND version = ?`
              )
              .run(comment.text, comment.id, comment.version)
      if (changes === 0) return ROLLBACK
      this.outbox.append(entries)
      return true
    })

    if (written === ROLLBACK) {
      return err(new ConflictError('Comment', comment.id))
    }
    return ok({ ...comment, version })
  }
}
