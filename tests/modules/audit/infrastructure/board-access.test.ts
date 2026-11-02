import { beforeEach, describe, expect, it, vi } from 'vitest'

import { getInjection } from '@/di/container'
import { BoardAccess } from '@/modules/audit/infrastructure/board-access'
import { addMember, createBoard } from '@/modules/boards/api'
import { resetMockStores } from '@/shared/infrastructure/mock-stores'
import { PersistenceError } from '@/shared/kernel/errors/infrastructure-error'
import { toUserId, type UserId } from '@/shared/kernel/user-id'

import { describeBoardAccessContract } from '@tests/contracts/board-access.contract'
import { givenUser } from '@tests/fixtures/users'

// The adapter's only IO is boards' `api.ts`, which runs on boards' own mock
// adapters here; boards' contract suites keep those honest on SQLite.
beforeEach(() => {
  resetMockStores()
})

async function givenBoard(owner: UserId, member: UserId): Promise<string> {
  const created = await createBoard({ actorId: owner, name: 'Launch plan' })
  if (!created.ok) throw new Error('setup failed')
  const added = await addMember({
    actorId: owner,
    boardId: created.value.boardId,
    userId: member,
  })
  if (!added.ok) throw new Error('setup failed')
  return created.value.boardId
}

describe('BoardAccess (over boards’ api.ts)', () => {
  describeBoardAccessContract({
    make: () => new BoardAccess(),
    givenBoard,
    givenUser,
  })

  it('translates an outage thrown by boards into its own PersistenceError', async () => {
    const outage = new PersistenceError('IBoardReader', { retryable: true })
    vi.spyOn(
      await getInjection('IBoardReader'),
      'roleOf'
    ).mockRejectedValueOnce(outage)

    const thrown = await new BoardAccess()
      .roleOf('board-1', toUserId('user-ada'))
      .catch((error: unknown) => error)

    expect(thrown).toBeInstanceOf(PersistenceError)
    expect(thrown).toMatchObject({
      port: 'IBoardAccess',
      retryable: true,
      cause: outage,
    })
  })
})
