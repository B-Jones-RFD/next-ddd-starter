import { describe, expect, it } from 'vitest'

import { toBoardId } from '@/modules/boards/domain/board/board-id'
import { toListId } from '@/modules/boards/domain/list/list-id'
import type { ListName } from '@/modules/boards/domain/list/list-name'
import type { IListRepository } from '@/modules/boards/domain/list/list-repository.port'
import { ConflictError, NotFoundError } from '@/shared/kernel/errors/app-error'
import type { IOutbox } from '@/shared/kernel/ports/outbox.port'
import { toUserId } from '@/shared/kernel/user-id'

import { aList } from '@tests/fixtures/lists'

type Make = () => { repository: IListRepository; outbox: IOutbox }

const actor = toUserId('user-owner')
const origin = { actorId: actor, causationId: null }

/** What every `IListRepository` adapter must do, with boards' outbox. */
export function describeListRepositoryContract(make: Make) {
  describe('IListRepository contract', () => {
    it('saves a new list at version 1, found by id', async () => {
      const { repository } = make()
      const list = aList({ version: 0 })

      const saved = await repository.save(list, [], origin)

      expect(saved).toEqual({ ok: true, value: { ...list, version: 1 } })
      expect(await repository.findById(list.id)).toEqual(saved)
    })

    it('returns NotFoundError for an unknown id', async () => {
      const { repository } = make()

      expect(await repository.findById(toListId('nowhere'))).toEqual({
        ok: false,
        error: new NotFoundError('List', 'nowhere'),
      })
    })

    it('rejects a second new list with the same id, writing nothing', async () => {
      const { repository, outbox } = make()
      const list = aList({ version: 0 })
      await repository.save(list, [], origin)

      const again = await repository.save(
        list,
        [
          {
            type: 'ListCreated',
            payload: { listId: list.id, boardId: list.boardId, name: 'Again' },
          },
        ],
        origin
      )

      expect(again).toEqual({
        ok: false,
        error: new ConflictError('List', list.id),
      })
      expect(await outbox.pending(10)).toEqual([])
    })

    it('rejects a stale version with ConflictError, writing nothing', async () => {
      const { repository, outbox } = make()
      const saved = await repository.save(aList({ version: 0 }), [], origin)
      if (!saved.ok) throw new Error('setup failed')
      await repository.save({ ...saved.value, position: 'k' }, [], origin)

      const stale = await repository.save(
        { ...saved.value, position: 'a' },
        [
          {
            type: 'ListReordered',
            payload: { listId: saved.value.id, boardId: saved.value.boardId },
          },
        ],
        origin
      )

      expect(stale).toEqual({
        ok: false,
        error: new ConflictError('List', saved.value.id),
      })
      expect(await outbox.pending(10)).toEqual([])
      const found = await repository.findById(saved.value.id)
      expect(found.ok && found.value).toMatchObject({
        position: 'k',
        version: 2,
      })
    })

    it('saves changed fields', async () => {
      const { repository } = make()
      const saved = await repository.save(aList({ version: 0 }), [], origin)
      if (!saved.ok) throw new Error('setup failed')
      const changed = {
        ...saved.value,
        name: 'Renamed' as ListName,
        position: 'Vk',
        archived: true,
      }

      const result = await repository.save(changed, [], origin)

      expect(result).toEqual({ ok: true, value: { ...changed, version: 2 } })
      expect(await repository.findById(changed.id)).toEqual(result)
    })

    it('finds a board’s last list by position then id, archived ones included', async () => {
      const { repository } = make()
      const boardId = toBoardId('board-last')
      for (const list of [
        aList({ id: toListId('list-b'), boardId, position: 'k' }),
        aList({ id: toListId('list-a'), boardId, position: 'k' }),
        aList({ boardId, position: 'V', archived: true }),
        aList({ boardId: toBoardId('board-other'), position: 'z' }),
      ]) {
        await repository.save({ ...list, version: 0 }, [], origin)
      }
      await repository.save(
        aList({ boardId, position: 'x', archived: true, version: 0 }),
        [],
        origin
      )

      const last = await repository.findLastOnBoard(boardId)

      expect(last).toMatchObject({ boardId, position: 'x', archived: true })
    })

    it('breaks a tie in position by id', async () => {
      const { repository } = make()
      const boardId = toBoardId('board-tie')
      await repository.save(
        aList({ id: toListId('list-z'), boardId, version: 0 }),
        [],
        origin
      )
      await repository.save(
        aList({ id: toListId('list-y'), boardId, version: 0 }),
        [],
        origin
      )

      expect(await repository.findLastOnBoard(boardId)).toMatchObject({
        id: 'list-z',
      })
    })

    it('finds no last list on a board with none', async () => {
      const { repository } = make()

      expect(await repository.findLastOnBoard(toBoardId('empty'))).toBeNull()
    })

    it('writes each event as a domain row and publishes its translation', async () => {
      const { repository, outbox } = make()
      const list = aList({ version: 0, name: 'Backlog' as ListName })
      const ids = { listId: list.id, boardId: list.boardId }
      const saved = await repository.save(
        list,
        [{ type: 'ListCreated', payload: { ...ids, name: 'Backlog' } }],
        origin
      )
      if (!saved.ok) throw new Error('setup failed')
      const renamed = await repository.save(
        { ...saved.value, name: 'Ideas' as ListName },
        [
          {
            type: 'ListRenamed',
            payload: { ...ids, from: 'Backlog', to: 'Ideas' },
          },
        ],
        origin
      )
      if (!renamed.ok) throw new Error('setup failed')
      await repository.save(
        { ...renamed.value, position: 'k' },
        [{ type: 'ListReordered', payload: ids }],
        origin
      )

      const rows = await outbox.pending(10)
      expect(rows.map((row) => [row.scope, row.envelope.type])).toEqual([
        ['domain', 'ListCreated'],
        ['integration', 'boards.ListCreated'],
        ['domain', 'ListRenamed'],
        ['integration', 'boards.ListRenamed'],
        ['domain', 'ListReordered'],
        ['integration', 'boards.ListReordered'],
      ])
      expect(rows[1]?.envelope).toMatchObject({
        version: 1,
        aggregateId: list.id,
        aggregateVersion: 1,
        actorId: actor,
        causationId: null,
        payload: { ...ids, name: 'Backlog' },
      })
      expect(rows[3]?.envelope).toMatchObject({
        version: 1,
        aggregateVersion: 2,
        payload: { ...ids, from: 'Backlog', to: 'Ideas' },
      })
      expect(rows[5]?.envelope).toMatchObject({
        version: 1,
        aggregateVersion: 3,
        payload: ids,
      })
    })
  })
}
