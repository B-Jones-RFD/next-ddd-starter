import { describe, expect, it } from 'vitest'

import type { IUserDirectory } from '@/modules/boards/application/ports/user-directory.port'
import { ValidationError } from '@/shared/kernel/errors/domain-error'
import type { UserId } from '@/shared/kernel/user-id'

/** What every `IUserDirectory` adapter must do. */
export function describeUserDirectoryContract(setup: {
  make: () => IUserDirectory
  /** Registers a user with identity, returning their id. */
  register: (displayName: string, email: string) => Promise<UserId>
}) {
  describe('IUserDirectory contract', () => {
    it('finds a registered user by email', async () => {
      const ada = await setup.register('Ada', 'ada@example.com')
      const ben = await setup.register('Ben', 'ben@example.com')

      expect(await setup.make().findByEmail(ada, 'Ben@Example.com')).toEqual({
        ok: true,
        value: { userId: ben, displayName: 'Ben', email: 'ben@example.com' },
      })
    })

    it('finds nobody for an email nobody registered', async () => {
      const ada = await setup.register('Ada', 'ada@example.com')

      expect(await setup.make().findByEmail(ada, 'nobody@example.com')).toEqual(
        { ok: true, value: null }
      )
    })

    it('returns ValidationError for an address that isn’t an email', async () => {
      const ada = await setup.register('Ada', 'ada@example.com')

      expect(await setup.make().findByEmail(ada, 'ben')).toEqual({
        ok: false,
        error: new ValidationError({ email: 'invalid' }),
      })
    })
  })
}
