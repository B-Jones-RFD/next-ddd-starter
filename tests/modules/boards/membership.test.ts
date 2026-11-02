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
  // Archived work exists too, so the Archived views filter by membership.
  const old = await api.createBoard({ actorId: ada, name: 'Old plan' })
  if (!old.ok) throw new Error('setup failed')
  await api.archiveBoard({
    actorId: ada,
    boardId: old.value.boardId,
    confirmName: 'Old plan',
  })
  const archived = await api.createTask({
    actorId: ada,
    listId: list.value.listId,
    title: 'Old idea',
  })
  if (!archived.ok) throw new Error('setup failed')
  await api.archiveTask({ actorId: ada, taskId: archived.value.taskId })
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
    'addMember',
    'removeMember',
    'leaveBoard',
    'transferOwnership',
    'archiveBoard',
    'restoreBoard',
    'archiveList',
    'restoreList',
    'archiveTask',
    'restoreTask',
  ],
  queries: {
    listBoards: () => api.listBoards({ actorId: outsider, view: 'archived' }),
    getBoard: () =>
      api.getBoard({ actorId: outsider, boardId, view: 'archived' }),
    getTask: () => api.getTask({ actorId: outsider, taskId }),
    searchUsers: () =>
      api.searchUsers({ actorId: outsider, boardId, email: 'ada@example.com' }),
    roleOf: () => api.roleOf({ boardId, userId: outsider }),
  },
})
