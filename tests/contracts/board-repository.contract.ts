import { describe, expect, it } from 'vitest'

import type { BoardName } from '@/modules/boards/domain/board/board-name'
import type { IBoardRepository } from '@/modules/boards/domain/board/board-repository.port'
import { toBoardId } from '@/modules/boards/domain/board/board-id'
import { toTagId } from '@/modules/boards/domain/board/tag'
import type { TagName } from '@/modules/boards/domain/board/tag-name'
import { ConflictError, NotFoundError } from '@/shared/kernel/errors/app-error'
import type { IOutbox } from '@/shared/kernel/ports/outbox.port'
import { toUserId } from '@/shared/kernel/user-id'

import { aBoard } from '@tests/fixtures/boards'

type Make = () => { repository: IBoardRepository; outbox: IOutbox }

const owner = toUserId('user-owner')
const origin = { actorId: owner, causationId: null }

/** What every `IBoardRepository` adapter must do, with boards' outbox. */
export function describeBoardRepositoryContract(make: Make) {
  describe('IBoardRepository contract', () => {
    it('saves a new board at version 1 with its members, found by id', async () => {
      const { repository } = make()
      const board = aBoard({
        version: 0,
        members: [
          { userId: owner, role: 'owner' },
          { userId: toUserId('user-member'), role: 'member' },
        ],
      })

      const saved = await repository.save(board, [], origin)

      expect(saved).toEqual({ ok: true, value: { ...board, version: 1 } })
      expect(await repository.findById(board.id)).toEqual(saved)
    })

    it('returns NotFoundError for an unknown id', async () => {
      const { repository } = make()

      expect(await repository.findById(toBoardId('nowhere'))).toEqual({
        ok: false,
        error: new NotFoundError('Board', 'nowhere'),
      })
    })

    it('rejects a second new board with the same id, writing nothing', async () => {
      const { repository, outbox } = make()
      const board = aBoard({ version: 0 })
      await repository.save(board, [], origin)

      const again = await repository.save(
        board,
        [
          {
            type: 'BoardCreated',
            payload: { boardId: board.id, name: board.name },
          },
        ],
        origin
      )

      expect(again).toEqual({
        ok: false,
        error: new ConflictError('Board', board.id),
      })
      expect(await outbox.pending(10)).toEqual([])
    })

    // #region stale-version
    it('rejects a stale version with ConflictError, writing nothing', async () => {
      const { repository, outbox } = make()
      const saved = await repository.save(aBoard({ version: 0 }), [], origin)
      if (!saved.ok) throw new Error('setup failed')
      await repository.save(saved.value, [], origin)

      const stale = await repository.save(
        { ...saved.value, name: 'Stale' as BoardName },
        [
          {
            type: 'BoardRenamed',
            payload: {
              boardId: saved.value.id,
              from: saved.value.name,
              to: 'Stale',
            },
          },
        ],
        origin
      )

      expect(stale).toEqual({
        ok: false,
        error: new ConflictError('Board', saved.value.id),
      })
      expect(await outbox.pending(10)).toEqual([])
      const found = await repository.findById(saved.value.id)
      expect(found.ok && found.value).toMatchObject({
        name: saved.value.name,
        version: 2,
      })
    })
    // #endregion stale-version

    it('saves changed fields and members', async () => {
      const { repository } = make()
      const saved = await repository.save(aBoard({ version: 0 }), [], origin)
      if (!saved.ok) throw new Error('setup failed')
      const changed = {
        ...saved.value,
        name: 'Renamed' as BoardName,
        archived: true,
        members: [
          { userId: toUserId('user-member'), role: 'owner' as const },
          { userId: owner, role: 'member' as const },
        ],
      }

      const result = await repository.save(changed, [], origin)

      expect(result).toEqual({ ok: true, value: { ...changed, version: 2 } })
      expect(await repository.findById(changed.id)).toEqual(result)
    })

    it('saves tags in the order they were defined, and their changes', async () => {
      const { repository } = make()
      const tags = [
        { id: toTagId('tag-z'), name: 'Urgent' as TagName, color: 'red' },
        { id: toTagId('tag-a'), name: 'Design' as TagName, color: 'teal' },
      ] as const
      const saved = await repository.save(
        aBoard({ version: 0, tags }),
        [],
        origin
      )
      if (!saved.ok) throw new Error('setup failed')
      expect(await repository.findById(saved.value.id)).toEqual(saved)

      const changed = {
        ...saved.value,
        tags: [{ ...tags[1], name: 'UX' as TagName, color: 'violet' as const }],
      }
      const result = await repository.save(changed, [], origin)

      expect(result).toEqual({ ok: true, value: { ...changed, version: 2 } })
      expect(await repository.findById(changed.id)).toEqual(result)
    })

    it('publishes tag events with their payloads', async () => {
      const { repository, outbox } = make()
      const board = aBoard({ version: 0 })
      const ids = { boardId: board.id, tagId: toTagId('tag-1') }
      await repository.save(
        board,
        [
          {
            type: 'TagCreated',
            payload: { ...ids, name: 'Urgent', color: 'red' },
          },
          { type: 'TagRenamed', payload: { ...ids, from: 'a', to: 'b' } },
          {
            type: 'TagRecolored',
            payload: { ...ids, from: 'red', to: 'blue' },
          },
          { type: 'TagDeleted', payload: { ...ids, name: 'b' } },
        ],
        origin
      )

      const rows = await outbox.pending(20)
      expect(
        rows
          .filter((row) => row.scope === 'integration')
          .map((row) => [row.envelope.type, row.envelope.payload])
      ).toEqual([
        ['boards.TagCreated', { ...ids, name: 'Urgent', color: 'red' }],
        ['boards.TagRenamed', { ...ids, from: 'a', to: 'b' }],
        ['boards.TagRecolored', { ...ids, from: 'red', to: 'blue' }],
        ['boards.TagDeleted', { ...ids, name: 'b' }],
      ])
    })

    it('writes each event as a domain row and publishes its translation', async () => {
      const { repository, outbox } = make()
      const board = aBoard({ version: 0, name: 'Launch plan' as BoardName })
      const saved = await repository.save(
        board,
        [
          {
            type: 'BoardCreated',
            payload: { boardId: board.id, name: 'Launch plan' },
          },
        ],
        origin
      )
      if (!saved.ok) throw new Error('setup failed')
      await repository.save(
        { ...saved.value, name: 'Launch' as BoardName },
        [
          {
            type: 'BoardRenamed',
            payload: { boardId: board.id, from: 'Launch plan', to: 'Launch' },
          },
        ],
        origin
      )

      const rows = await outbox.pending(10)
      expect(rows.map((row) => [row.scope, row.envelope.type])).toEqual([
        ['domain', 'BoardCreated'],
        ['integration', 'boards.BoardCreated'],
        ['domain', 'BoardRenamed'],
        ['integration', 'boards.BoardRenamed'],
      ])
      expect(rows[1]?.envelope).toMatchObject({
        version: 1,
        aggregateId: board.id,
        aggregateVersion: 1,
        actorId: owner,
        causationId: null,
        payload: { boardId: board.id, name: 'Launch plan' },
      })
      expect(rows[3]?.envelope).toMatchObject({
        version: 1,
        aggregateVersion: 2,
        payload: { boardId: board.id, from: 'Launch plan', to: 'Launch' },
      })
    })

    it('publishes archiving and restoring the board', async () => {
      const { repository, outbox } = make()
      const saved = await repository.save(aBoard({ version: 0 }), [], origin)
      if (!saved.ok) throw new Error('setup failed')
      const payload = { boardId: saved.value.id }
      const archived = await repository.save(
        { ...saved.value, archived: true },
        [{ type: 'BoardArchived', payload }],
        origin
      )
      if (!archived.ok) throw new Error('setup failed')
      await repository.save(
        { ...archived.value, archived: false },
        [{ type: 'BoardRestored', payload }],
        origin
      )

      const rows = await outbox.pending(10)
      expect(rows.map((row) => [row.scope, row.envelope.type])).toEqual([
        ['domain', 'BoardArchived'],
        ['integration', 'boards.BoardArchived'],
        ['domain', 'BoardRestored'],
        ['integration', 'boards.BoardRestored'],
      ])
      expect(rows[1]?.envelope).toMatchObject({ version: 1, payload })
      expect(rows[3]?.envelope).toMatchObject({ version: 1, payload })
    })
  })
}
