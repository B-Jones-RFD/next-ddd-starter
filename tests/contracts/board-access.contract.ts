import { describe, expect, it } from 'vitest'

import type { IBoardAccess } from '@/modules/audit/application/ports/board-access.port'
import type { UserId } from '@/shared/kernel/user-id'

/** What every `IBoardAccess` adapter must do. */
export function describeBoardAccessContract(setup: {
  make: () => IBoardAccess
  /** A board owned by `owner`, with `member` as a Member; returns its id. */
  givenBoard: (owner: UserId, member: UserId) => Promise<string>
  /** Registers a user, returning their id. */
  givenUser: (displayName: string, email: string) => Promise<UserId>
}) {
  describe('IBoardAccess contract', () => {
    it('gives the Owner’s and a Member’s role, and null for anyone else', async () => {
      const ada = await setup.givenUser('Ada', 'ada@example.com')
      const ben = await setup.givenUser('Ben', 'ben@example.com')
      const cy = await setup.givenUser('Cy', 'cy@example.com')
      const boardId = await setup.givenBoard(ada, ben)
      const access = setup.make()

      expect(await access.roleOf(boardId, ada)).toBe('owner')
      expect(await access.roleOf(boardId, ben)).toBe('member')
      expect(await access.roleOf(boardId, cy)).toBeNull()
    })

    it('gives null for a board that doesn’t exist, or an empty id', async () => {
      const ada = await setup.givenUser('Ada', 'ada@example.com')
      const access = setup.make()

      expect(await access.roleOf('no-such-board', ada)).toBeNull()
      expect(await access.roleOf('', ada)).toBeNull()
    })
  })
}
