import { describe, expect, it } from 'vitest'

import { NotAMemberError } from '@/modules/boards/domain/board/board.errors'
import { toBoardId } from '@/modules/boards/domain/board/board-id'
import {
  assignTask,
  handOverToOwner,
  unassignTask,
} from '@/modules/boards/domain/services/task-assignment.service'
import { ForbiddenError } from '@/shared/kernel/errors/domain-error'
import { toUserId } from '@/shared/kernel/user-id'

import { aBoard } from '@tests/fixtures/boards'
import { aTask } from '@tests/fixtures/tasks'

const ada = toUserId('user-ada')
const ben = toUserId('user-ben')
const cy = toUserId('user-cy')
const boardId = toBoardId('board-lists')
const board = aBoard({
  id: boardId,
  members: [
    { userId: ada, role: 'owner' },
    { userId: ben, role: 'member' },
  ],
})

describe('assignTask', () => {
  it('adds a Board member as an assignee and raises TaskAssigned', () => {
    const task = aTask({ boardId })

    const assigned = assignTask(task, board, ben, ada)

    expect(assigned.ok && assigned.value.state.assignees).toEqual([ada])
    expect(assigned.ok && assigned.value.events).toEqual([
      {
        type: 'TaskAssigned',
        payload: { taskId: task.id, boardId, userId: ada },
      },
    ])
  })

  it('keeps earlier assignees, in the order they were assigned', () => {
    const task = aTask({ boardId, assignees: [ben] })

    const assigned = assignTask(task, board, ben, ada)

    expect(assigned.ok && assigned.value.state.assignees).toEqual([ben, ada])
  })

  it('raises nothing for someone already assigned', () => {
    const task = aTask({ boardId, assignees: [ada] })

    const assigned = assignTask(task, board, ben, ada)

    expect(assigned).toEqual({ ok: true, value: { state: task, events: [] } })
  })

  it('refuses an assignee who isn’t a Board member', () => {
    const assigned = assignTask(aTask({ boardId }), board, ada, cy)

    expect(assigned).toEqual({ ok: false, error: new NotAMemberError() })
  })

  it('refuses an actor who isn’t a Board member', () => {
    const assigned = assignTask(aTask({ boardId }), board, cy, ada)

    expect(assigned).toEqual({ ok: false, error: new ForbiddenError() })
  })
})

describe('unassignTask', () => {
  it('removes an assignee and raises TaskUnassigned', () => {
    const task = aTask({ boardId, assignees: [ben, ada] })

    const unassigned = unassignTask(task, board, ben, ben)

    expect(unassigned.ok && unassigned.value.state.assignees).toEqual([ada])
    expect(unassigned.ok && unassigned.value.events).toEqual([
      {
        type: 'TaskUnassigned',
        payload: { taskId: task.id, boardId, userId: ben },
      },
    ])
  })

  it('raises nothing for someone who isn’t assigned', () => {
    const task = aTask({ boardId, assignees: [ada] })

    const unassigned = unassignTask(task, board, ben, ben)

    expect(unassigned).toEqual({ ok: true, value: { state: task, events: [] } })
  })

  it('lets a Board member unassign someone no longer on the board', () => {
    const task = aTask({ boardId, assignees: [cy] })

    const unassigned = unassignTask(task, board, ada, cy)

    expect(unassigned.ok && unassigned.value.state.assignees).toEqual([])
  })

  it('refuses an actor who isn’t a Board member', () => {
    const task = aTask({ boardId, assignees: [ada] })

    const unassigned = unassignTask(task, board, cy, ada)

    expect(unassigned).toEqual({ ok: false, error: new ForbiddenError() })
  })
})

describe('handOverToOwner', () => {
  // Ben has left: the board no longer lists him.
  const after = aBoard({
    id: boardId,
    members: [{ userId: ada, role: 'owner' }],
  })

  it('passes the leaver’s assignment to the Owner, raising TaskUnassigned then TaskAssigned', () => {
    const task = aTask({ boardId, assignees: [ben, cy] })

    const handed = handOverToOwner(task, after, ben)

    expect(handed.state.assignees).toEqual([cy, ada])
    expect(handed.events).toEqual([
      {
        type: 'TaskUnassigned',
        payload: { taskId: task.id, boardId, userId: ben },
      },
      {
        type: 'TaskAssigned',
        payload: { taskId: task.id, boardId, userId: ada },
      },
    ])
  })

  it('doesn’t assign the Owner twice', () => {
    const task = aTask({ boardId, assignees: [ada, ben] })

    const handed = handOverToOwner(task, after, ben)

    expect(handed.state.assignees).toEqual([ada])
    expect(handed.events.map((event) => event.type)).toEqual(['TaskUnassigned'])
  })

  it('hands over an archived task too', () => {
    const task = aTask({ boardId, assignees: [ben], archived: true })

    expect(handOverToOwner(task, after, ben).state.assignees).toEqual([ada])
  })

  it('changes nothing if they aren’t assigned', () => {
    const task = aTask({ boardId, assignees: [cy] })

    expect(handOverToOwner(task, after, ben)).toEqual({
      state: task,
      events: [],
    })
  })

  it('changes nothing if they are a Board member again', () => {
    const task = aTask({ boardId, assignees: [ben] })

    expect(handOverToOwner(task, board, ben)).toEqual({
      state: task,
      events: [],
    })
  })
})
