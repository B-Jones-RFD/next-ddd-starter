import { beforeEach, describe, expect, it, vi } from 'vitest'

import { getInjection } from '@/di/container'
import { UserDirectory } from '@/modules/boards/infrastructure/user-directory'
import * as identity from '@/modules/identity/api'
import { resetMockStores } from '@/shared/infrastructure/mock-stores'
import { PersistenceError } from '@/shared/kernel/errors/infrastructure-error'
import { toUserId } from '@/shared/kernel/user-id'

import { describeUserDirectoryContract } from '@tests/contracts/user-directory.contract'
import { aSignUp } from '@tests/fixtures/identity'

// The adapter's only IO is identity's `api.ts`, which runs on identity's own
// mock adapters here; identity's contract suites keep those honest on SQLite.
beforeEach(() => {
  resetMockStores()
})

async function register(displayName: string, email: string) {
  const signedUp = await identity.signUp(aSignUp({ displayName, email }))
  if (!signedUp.ok) throw new Error('sign-up failed')
  const actor = await identity.authenticate(signedUp.value.token)
  if (!actor.ok) throw new Error('authenticate failed')
  return actor.value.userId
}

describe('UserDirectory (over identity’s api.ts)', () => {
  describeUserDirectoryContract({ make: () => new UserDirectory(), register })

  it('translates an outage thrown by identity into its own PersistenceError', async () => {
    const outage = new PersistenceError('IUserRepository', { retryable: true })
    vi.spyOn(
      await getInjection('IUserRepository'),
      'findByEmail'
    ).mockRejectedValueOnce(outage)

    const thrown = await new UserDirectory()
      .findByEmail(toUserId('user-ada'), 'ben@example.com')
      .catch((error: unknown) => error)

    expect(thrown).toBeInstanceOf(PersistenceError)
    expect(thrown).toMatchObject({
      port: 'IUserDirectory',
      retryable: true,
      cause: outage,
    })
  })
})
