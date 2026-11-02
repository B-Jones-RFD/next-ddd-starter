import { beforeEach } from 'vitest'

import * as api from '@/modules/boards/api'
import { resetMockStores } from '@/shared/infrastructure/mock-stores'
import { toUserId } from '@/shared/kernel/user-id'

import { describeMembershipProof } from '@tests/fixtures/membership'
import { givenUser } from '@tests/fixtures/users'

const outsider = toUserId('user-outsider')
let boardId = ''

// Someone else's board exists, so an empty or forbidden answer means the
// read filtered by membership, not that there was nothing to find.
beforeEach(async () => {
  resetMockStores()
  const ada = await givenUser('Ada', 'ada@example.com')
  const created = await api.createBoard({ actorId: ada, name: 'Launch plan' })
  if (!created.ok) throw new Error('setup failed')
  boardId = created.value.boardId
})

describeMembershipProof('boards', api, {
  commands: [
    'createBoard',
    'renameBoard',
    'createList',
    'renameList',
    'moveList',
    'addMember',
    'removeMember',
    'leaveBoard',
    'transferOwnership',
  ],
  queries: {
    listBoards: () => api.listBoards({ actorId: outsider }),
    getBoard: () => api.getBoard({ actorId: outsider, boardId }),
    searchUsers: () =>
      api.searchUsers({ actorId: outsider, boardId, email: 'ada@example.com' }),
    roleOf: () => api.roleOf({ boardId, userId: outsider }),
  },
})
