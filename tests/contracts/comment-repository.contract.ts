import { describe, expect, it } from 'vitest'

import type { ICommentRepository } from '@/modules/boards/domain/comment/comment-repository.port'
import { toCommentId } from '@/modules/boards/domain/comment/comment-id'
import type { CommentText } from '@/modules/boards/domain/comment/comment-text'
import { ConflictError, NotFoundError } from '@/shared/kernel/errors/app-error'
import type { IOutbox } from '@/shared/kernel/ports/outbox.port'
import { toUserId } from '@/shared/kernel/user-id'

import { aComment } from '@tests/fixtures/comments'

type Make = () => { repository: ICommentRepository; outbox: IOutbox }

const actor = toUserId('user-ben')
const origin = { actorId: actor, causationId: null }

/** What every `ICommentRepository` adapter must do, with boards' outbox. */
export function describeCommentRepositoryContract(make: Make) {
  describe('ICommentRepository contract', () => {
    it('saves a new comment at version 1, found by id', async () => {
      const { repository } = make()
      const comment = aComment({
        version: 0,
        text: 'Line one\nLine two' as CommentText,
      })

      const saved = await repository.save(comment, [], origin)

      expect(saved).toEqual({ ok: true, value: { ...comment, version: 1 } })
      expect(await repository.findById(comment.id)).toEqual(saved)
    })

    it('returns NotFoundError for an unknown id', async () => {
      const { repository } = make()

      expect(await repository.findById(toCommentId('nowhere'))).toEqual({
        ok: false,
        error: new NotFoundError('Comment', 'nowhere'),
      })
    })

    it('rejects a second new comment with the same id, writing nothing', async () => {
      const { repository, outbox } = make()
      const comment = aComment({ version: 0 })
      await repository.save(comment, [], origin)

      const again = await repository.save(
        comment,
        [
          {
            type: 'CommentAdded',
            payload: {
              commentId: comment.id,
              taskId: comment.taskId,
              boardId: comment.boardId,
              text: 'Again',
            },
          },
        ],
        origin
      )

      expect(again).toEqual({
        ok: false,
        error: new ConflictError('Comment', comment.id),
      })
      expect(await outbox.pending(10)).toEqual([])
    })

    it('rejects a stale version with ConflictError', async () => {
      const { repository } = make()
      const saved = await repository.save(aComment({ version: 0 }), [], origin)
      if (!saved.ok) throw new Error('setup failed')
      await repository.save(saved.value, [], origin)

      expect(await repository.save(saved.value, [], origin)).toEqual({
        ok: false,
        error: new ConflictError('Comment', saved.value.id),
      })
    })

    it('writes its event as a domain row and publishes its translation', async () => {
      const { repository, outbox } = make()
      const comment = aComment({ version: 0 })
      const payload = {
        commentId: comment.id,
        taskId: comment.taskId,
        boardId: comment.boardId,
        text: comment.text,
      }

      await repository.save(
        comment,
        [{ type: 'CommentAdded', payload }],
        origin
      )

      const rows = await outbox.pending(10)
      expect(rows.map((row) => [row.scope, row.envelope.type])).toEqual([
        ['domain', 'CommentAdded'],
        ['integration', 'boards.CommentAdded'],
      ])
      expect(rows[1]?.envelope).toMatchObject({
        version: 1,
        aggregateId: comment.id,
        aggregateVersion: 1,
        actorId: actor,
        causationId: null,
        payload,
      })
    })
  })
}
