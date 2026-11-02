import { beforeEach } from 'vitest'

import { getInjection } from '@/di/container'
import * as api from '@/modules/audit/api'
import { createBoard, createList, createTask } from '@/modules/boards/api'
import { resetMockStores } from '@/shared/infrastructure/mock-stores'
import type { UserId } from '@/shared/kernel/user-id'

import { describeMembershipProof } from '@tests/fixtures/membership'
import { givenUser } from '@tests/fixtures/users'

let cy: UserId
let taskId: string

// Ada's board, with a task that has Activity, which Cy isn't a member of.
beforeEach(async () => {
  resetMockStores()
  const ada = await givenUser('Ada', 'ada@example.com')
  cy = await givenUser('Cy', 'cy@example.com')
  const board = await createBoard({ actorId: ada, name: 'Launch plan' })
  if (!board.ok) throw new Error('setup failed')
  const list = await createList({
    actorId: ada,
    boardId: board.value.boardId,
    name: 'Backlog',
  })
  if (!list.ok) throw new Error('setup failed')
  const task = await createTask({
    actorId: ada,
    listId: list.value.listId,
    title: 'Write the brief',
  })
  if (!task.ok) throw new Error('setup failed')
  taskId = task.value.taskId
  await (await getInjection('IEventRelay')).drain()
})

describeMembershipProof('audit', api, {
  commands: [],
  queries: {
    getActivity: () => api.getActivity({ actorId: cy, taskId }),
  },
})
