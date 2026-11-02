import { beforeEach } from 'vitest'

import * as api from '@/modules/boards/api'
import { resetMockStores } from '@/shared/infrastructure/mock-stores'
import { toUserId } from '@/shared/kernel/user-id'

import { describeMembershipProof } from '@tests/fixtures/membership'

beforeEach(() => {
  resetMockStores()
})

const outsider = toUserId('user-outsider')

describeMembershipProof('boards', api, {
  commands: [],
  queries: {
    listBoards: () => api.listBoards({ actorId: outsider }),
  },
})
