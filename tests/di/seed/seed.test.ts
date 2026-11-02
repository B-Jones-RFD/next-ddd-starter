import { beforeEach, describe, expect, it } from 'vitest'

import { seed, SEED_PASSWORD } from '@/di/seed/seed'
import { getBoard, listBoards } from '@/modules/boards/api'
import { authenticate, signIn } from '@/modules/identity/api'
import { resetMockStores } from '@/shared/infrastructure/mock-stores'

beforeEach(() => {
  resetMockStores()
})

describe('seed', () => {
  it.each(['ada@example.com', 'ben@example.com', 'cy@example.com'])(
    'lets %s sign in with the seed password',
    async (email) => {
      await seed()

      expect((await signIn({ email, password: SEED_PASSWORD })).ok).toBe(true)
    }
  )

  it('gives Ada her board “Launch plan” as its Owner, with Ben as a Member, once however often it runs', async () => {
    await seed()
    await seed()

    const ada = await actorFor('ada@example.com')
    const ben = await actorFor('ben@example.com')
    const launchPlan = {
      id: expect.any(String),
      name: 'Launch plan',
      members: [
        { userId: ada, displayName: 'Ada', role: 'owner' },
        { userId: ben, displayName: 'Ben', role: 'member' },
      ],
    }
    expect(await listBoards({ actorId: ada })).toEqual({
      ok: true,
      value: [launchPlan],
    })
    expect(await listBoards({ actorId: ben })).toEqual({
      ok: true,
      value: [launchPlan],
    })
  })

  it('keeps Cy off every board', async () => {
    await seed()

    const cy = await actorFor('cy@example.com')
    expect(await listBoards({ actorId: cy })).toEqual({ ok: true, value: [] })
  })

  it('gives “Launch plan” three lists in order, once however often it runs', async () => {
    await seed()
    await seed()

    const ada = await actorFor('ada@example.com')
    const boards = await listBoards({ actorId: ada })
    const boardId = boards.ok ? boards.value[0]?.id : undefined
    const board = await getBoard({ actorId: ada, boardId: boardId ?? '' })
    expect(board.ok && board.value.lists.map((list) => list.name)).toEqual([
      'Backlog',
      'In progress',
      'Done',
    ])
  })
})

async function actorFor(email: string) {
  const session = await signIn({ email, password: SEED_PASSWORD })
  if (!session.ok) throw new Error('sign-in failed')
  const actor = await authenticate(session.value.token)
  if (!actor.ok) throw new Error('authenticate failed')
  return actor.value.userId
}
