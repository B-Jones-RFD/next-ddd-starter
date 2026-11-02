import { beforeEach } from 'vitest'

import * as api from '@/modules/identity/api'
import { resetMockStores } from '@/shared/infrastructure/mock-stores'
import { toUserId } from '@/shared/kernel/user-id'

import { describeMembershipProof } from '@tests/fixtures/membership'
import { givenUser } from '@tests/fixtures/users'

// In identity, membership is having registered: someone else's account is
// there to be found, so an empty answer would prove nothing.
const outsider = toUserId('user-never-registered')

beforeEach(async () => {
  resetMockStores()
  await givenUser('Ben', 'ben@example.com')
})

describeMembershipProof('identity', api, {
  commands: [
    'signUp',
    'signIn',
    'signOut',
    'signOutEverywhere',
    'changePassword',
    'rename',
  ],
  queries: {
    findUserByEmail: () =>
      api.findUserByEmail({ actorId: outsider, email: 'ben@example.com' }),
  },
  exempt: {
    authenticate:
      'Takes a session token, not an actor; it only ever reveals the token’s own user.',
  },
})
