import { describe, expect, it } from 'vitest'

import type { IBoardReader } from '@/modules/boards/application/ports/board-reader.port'
import type { IPeopleProjection } from '@/modules/boards/application/ports/people-projection.port'
import type { Board } from '@/modules/boards/domain/board/board'
import type { BoardName } from '@/modules/boards/domain/board/board-name'
import type { IBoardRepository } from '@/modules/boards/domain/board/board-repository.port'
import { toBoardId } from '@/modules/boards/domain/board/board-id'
import { toListId } from '@/modules/boards/domain/list/list-id'
import type { ListName } from '@/modules/boards/domain/list/list-name'
import type { IListRepository } from '@/modules/boards/domain/list/list-repository.port'
import { NotFoundError } from '@/shared/kernel/errors/app-error'
import { ForbiddenError } from '@/shared/kernel/errors/domain-error'
import { toUserId } from '@/shared/kernel/user-id'

import { aBoard } from '@tests/fixtures/boards'
import { aList } from '@tests/fixtures/lists'

type Make = () => {
  reader: IBoardReader
  boards: IBoardRepository
  people: IPeopleProjection
  lists: IListRepository
}

const ada = toUserId('user-ada')
const ben = toUserId('user-ben')
const cy = toUserId('user-cy')

/** What every `IBoardReader` adapter must do, over boards' own stores. */
export function describeBoardReaderContract(make: Make) {
  async function given(boards: IBoardRepository, board: Board) {
    const saved = await boards.save({ ...board, version: 0 }, [], {
      actorId: ada,
      causationId: null,
    })
    if (!saved.ok) throw new Error('setup failed')
    return saved.value
  }

  async function knownAs(
    people: IPeopleProjection,
    userId: typeof ada,
    name: string
  ) {
    await people.record({ userId, displayName: name }, 1, {
      eventId: `registered-${userId}`,
      handler: 'boards.recordUserRegistered',
    })
  }

  describe('IBoardReader contract', () => {
    it('lists only the boards the user is a Board member of, by name, with members Owner first', async () => {
      const { reader, boards, people } = make()
      await knownAs(people, ada, 'Ada')
      await knownAs(people, ben, 'Ben')
      const zeta = await given(
        boards,
        aBoard({
          name: 'Zeta' as BoardName,
          members: [
            { userId: ben, role: 'member' },
            { userId: ada, role: 'owner' },
          ],
        })
      )
      const alpha = await given(
        boards,
        aBoard({
          name: 'Alpha' as BoardName,
          members: [{ userId: ben, role: 'owner' }],
        })
      )
      await given(boards, aBoard({ members: [{ userId: cy, role: 'owner' }] }))

      expect(await reader.listForMember(ben)).toEqual([
        {
          id: alpha.id,
          name: 'Alpha',
          members: [{ userId: ben, displayName: 'Ben', role: 'owner' }],
        },
        {
          id: zeta.id,
          name: 'Zeta',
          members: [
            { userId: ada, displayName: 'Ada', role: 'owner' },
            { userId: ben, displayName: 'Ben', role: 'member' },
          ],
        },
      ])
    })

    it('lists nothing for a user on no board', async () => {
      const { reader, boards } = make()
      await given(boards, aBoard({ members: [{ userId: ada, role: 'owner' }] }))

      expect(await reader.listForMember(cy)).toEqual([])
    })

    it('gives a null display name for a member boards hasn’t heard of yet', async () => {
      const { reader, boards } = make()
      const board = await given(
        boards,
        aBoard({ members: [{ userId: ada, role: 'owner' }] })
      )

      const listed = await reader.listForMember(ada)

      expect(listed).toEqual([
        {
          id: board.id,
          name: board.name,
          members: [{ userId: ada, displayName: null, role: 'owner' }],
        },
      ])
    })

    it('gets a board for a Board member, with their role', async () => {
      const { reader, boards, people } = make()
      await knownAs(people, ada, 'Ada')
      await knownAs(people, ben, 'Ben')
      const board = await given(
        boards,
        aBoard({
          name: 'Launch plan' as BoardName,
          members: [
            { userId: ada, role: 'owner' },
            { userId: ben, role: 'member' },
          ],
        })
      )

      expect(await reader.getForMember(board.id, ben)).toEqual({
        ok: true,
        value: {
          id: board.id,
          name: 'Launch plan',
          archived: false,
          role: 'member',
          members: [
            { userId: ada, displayName: 'Ada', role: 'owner' },
            { userId: ben, displayName: 'Ben', role: 'member' },
          ],
          lists: [],
        },
      })
    })

    it('gets a board with its active lists by position, then id', async () => {
      const { reader, boards, lists } = make()
      const board = await given(
        boards,
        aBoard({ members: [{ userId: ada, role: 'owner' }] })
      )
      const on = (list: Parameters<typeof aList>[0]) =>
        lists.save(aList({ boardId: board.id, version: 0, ...list }), [], {
          actorId: ada,
          causationId: null,
        })
      await on({ name: 'Done' as ListName, position: 'l' })
      await on({ name: 'Archived' as ListName, position: 'G', archived: true })
      await on({
        id: toListId('list-b'),
        name: 'Doing' as ListName,
        position: 'V',
      })
      await on({
        id: toListId('list-a'),
        name: 'Backlog' as ListName,
        position: 'V',
      })
      await on({ boardId: toBoardId('board-elsewhere'), position: 'A' })

      const found = await reader.getForMember(board.id, ada)

      expect(found.ok && found.value.lists).toEqual([
        { id: 'list-a', name: 'Backlog' },
        { id: 'list-b', name: 'Doing' },
        { id: expect.any(String), name: 'Done' },
      ])
    })

    it('returns ForbiddenError for a user who isn’t a Board member', async () => {
      const { reader, boards } = make()
      const board = await given(
        boards,
        aBoard({ members: [{ userId: ada, role: 'owner' }] })
      )

      expect(await reader.getForMember(board.id, cy)).toEqual({
        ok: false,
        error: new ForbiddenError(),
      })
    })

    it('returns NotFoundError for a board that doesn’t exist', async () => {
      const { reader } = make()

      expect(await reader.getForMember('nowhere', ada)).toEqual({
        ok: false,
        error: new NotFoundError('Board', 'nowhere'),
      })
    })

    it('gives each user’s role on a board, and null for anyone else', async () => {
      const { reader, boards } = make()
      const board = await given(
        boards,
        aBoard({
          members: [
            { userId: ada, role: 'owner' },
            { userId: ben, role: 'member' },
          ],
        })
      )

      expect(await reader.roleOf(board.id, ada)).toBe('owner')
      expect(await reader.roleOf(board.id, ben)).toBe('member')
      expect(await reader.roleOf(board.id, cy)).toBeNull()
      expect(await reader.roleOf('nowhere', ada)).toBeNull()
    })
  })
}
