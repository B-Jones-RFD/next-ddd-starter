import { beforeEach } from 'vitest'

import * as api from '@/modules/identity/api'
import { resetMockStores } from '@/shared/infrastructure/mock-stores'

import { describeMembershipProof } from '@tests/fixtures/membership'

beforeEach(() => {
  resetMockStores()
})

describeMembershipProof('identity', api, {
  commands: ['signUp'],
  queries: {},
  exempt: {
    authenticate:
      'Takes a session token, not an actor; it only ever reveals the token’s own user.',
  },
})
