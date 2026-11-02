import { beforeEach } from 'vitest'

import * as api from '@/modules/boards/api'
import { resetMockStores } from '@/shared/infrastructure/mock-stores'
import { toUserId } from '@/shared/kernel/user-id'

import { describeMembershipProof } from '@tests/fixtures/membership'
import { givenUser } from '@tests/fixtures/users'

const outsider = toUserId('user-outsider')
let boardId = ''
let taskId = ''

// Someone else's board exists, so an empty or forbidden answer means the
// read filtered by membership, not that there was nothing to find.
beforeEach(async () => {
  resetMockStores()
  const ada = await givenUser('Ada', 'ada@example.com')
  const created = await api.createBoard({ actorId: ada, name: 'Launch plan' })
  if (!created.ok) throw new Error('setup failed')
  boardId = created.value.boardId
  const list = await api.createList({ actorId: ada, boardId, name: 'Backlog' })
  if (!list.ok) throw new Error('setup failed')
  const task = await api.createTask({
    actorId: ada,
    listId: list.value.listId,
    title: 'Write the brief',
  })
  if (!task.ok) throw new Error('setup failed')
  taskId = task.value.taskId
  const tag = await api.createTag({
    actorId: ada,
    boardId,
    name: 'Urgent',
    color: 'red',
  })
  if (!tag.ok) throw new Error('setup failed')
})

describeMembershipProof('boards', api, {
  commands: [
    'createBoard',
    'renameBoard',
    'createList',
    'renameList',
    'moveList',
    'createTask',
    'renameTask',
    'changeTaskDescription',
    'reorderTask',
    'moveTask',
    'assignTask',
    'unassignTask',
    'addMember',
    'removeMember',
    'leaveBoard',
    'transferOwnership',
    'createTag',
    'renameTag',
    'recolorTag',
    'deleteTag',
    'tagTask',
    'untagTask',
  ],
  queries: {
    listBoards: () => api.listBoards({ actorId: outsider }),
    getBoard: () => api.getBoard({ actorId: outsider, boardId }),
    getTask: () => api.getTask({ actorId: outsider, taskId }),
    searchUsers: () =>
      api.searchUsers({ actorId: outsider, boardId, email: 'ada@example.com' }),
    roleOf: () => api.roleOf({ boardId, userId: outsider }),
    listTags: () => api.listTags({ actorId: outsider, boardId }),
  },
})
