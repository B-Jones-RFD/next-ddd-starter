import { describe, expect, it } from 'vitest'

import type { IBoardReader } from '@/modules/boards/application/ports/board-reader.port'
import type { IPeopleProjection } from '@/modules/boards/application/ports/people-projection.port'
import type { Board } from '@/modules/boards/domain/board/board'
import type { BoardName } from '@/modules/boards/domain/board/board-name'
import type { IBoardRepository } from '@/modules/boards/domain/board/board-repository.port'
import { NotFoundError } from '@/shared/kernel/errors/app-error'
import { ForbiddenError } from '@/shared/kernel/errors/domain-error'
import { toUserId } from '@/shared/kernel/user-id'

import { aBoard } from '@tests/fixtures/boards'

type Make = () => {
  reader: IBoardReader
  boards: IBoardRepository
  people: IPeopleProjection
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
        },
      })
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
  })
}
