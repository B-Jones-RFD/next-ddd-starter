import { describe, expect, it } from 'vitest'

import type { BoardName } from '@/modules/boards/domain/board/board-name'
import type { IBoardRepository } from '@/modules/boards/domain/board/board-repository.port'
import { toBoardId } from '@/modules/boards/domain/board/board-id'
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
  })
}
