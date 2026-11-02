import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { getInjection } from '@/di/container'
import {
  addMember,
  assignTask,
  ConflictError,
  createBoard,
  createList,
  createTask,
  ForbiddenError,
  getBoard,
  getTask,
  leaveBoard,
  NotAMemberError,
  NotFoundError,
  removeMember,
  renameTask,
  transferOwnership,
  unassignTask,
  ValidationError,
} from '@/modules/boards/api'
import { toTaskId } from '@/modules/boards/domain/task/task-id'
import { resetMockStores } from '@/shared/infrastructure/mock-stores'
import type { UserId } from '@/shared/kernel/user-id'

import { givenUser } from '@tests/fixtures/users'

let ada: UserId
let ben: UserId
let cy: UserId
let boardId: string
let listId: string
let taskId: string

beforeEach(async () => {
  resetMockStores()
  ada = await givenUser('Ada')
  ben = await givenUser('Ben')
  cy = await givenUser('Cy')
  const created = await createBoard({ actorId: ada, name: 'Launch plan' })
  if (!created.ok) throw new Error('setup failed')
  boardId = created.value.boardId
  const added = await addMember({ actorId: ada, boardId, userId: ben })
  if (!added.ok) throw new Error('setup failed')
  const list = await createList({ actorId: ada, boardId, name: 'Backlog' })
  if (!list.ok) throw new Error('setup failed')
  listId = list.value.listId
  taskId = await givenTask('Write the brief')
})

afterEach(() => {
  vi.restoreAllMocks()
})

async function givenTask(title: string): Promise<string> {
  const task = await createTask({ actorId: ada, listId, title })
  if (!task.ok) throw new Error('setup failed')
  return task.value.taskId
}

/** The task's assignees as Ada reads them in its dialog. */
async function assigneesOf(id = taskId) {
  const task = await getTask({ actorId: ada, taskId: id })
  if (!task.ok) throw new Error('read failed')
  return task.value.assignees
}

describe('assignTask', () => {
  it('makes a Board member an assignee, shown with their display name', async () => {
    const result = await assignTask({ actorId: ben, taskId, userId: ada })

    expect(result).toEqual({ ok: true, value: undefined })
    expect(await assigneesOf()).toEqual([{ userId: ada, displayName: 'Ada' }])
  })

  it('gives a task any number of assignees, in the order they were assigned, also on its card', async () => {
    await assignTask({ actorId: ada, taskId, userId: ben })
    await assignTask({ actorId: ada, taskId, userId: ada })

    expect(await assigneesOf()).toEqual([
      { userId: ben, displayName: 'Ben' },
      { userId: ada, displayName: 'Ada' },
    ])
    const board = await getBoard({ actorId: ben, boardId })
    expect(board.ok && board.value.lists[0]?.tasks).toEqual([
      {
        id: taskId,
        title: 'Write the brief',
        assignees: [
          { userId: ben, displayName: 'Ben' },
          { userId: ada, displayName: 'Ada' },
        ],
      },
    ])
  })

  it('keeps assignees unique: assigning someone again changes nothing', async () => {
    await assignTask({ actorId: ada, taskId, userId: ben })

    const again = await assignTask({ actorId: ada, taskId, userId: ben })

    expect(again).toEqual({ ok: true, value: undefined })
    expect(await assigneesOf()).toEqual([{ userId: ben, displayName: 'Ben' }])
  })

  it('returns NotAMemberError for a user who isn’t a Board member, assigning nobody', async () => {
    expect(await assignTask({ actorId: ada, taskId, userId: cy })).toEqual({
      ok: false,
      error: new NotAMemberError(),
    })
    expect(await assigneesOf()).toEqual([])
  })

  it('returns ForbiddenError for an actor who isn’t a Board member', async () => {
    expect(await assignTask({ actorId: cy, taskId, userId: cy })).toEqual({
      ok: false,
      error: new ForbiddenError(),
    })
  })

  it('returns NotFoundError for a task that doesn’t exist', async () => {
    expect(
      await assignTask({ actorId: ada, taskId: 'nowhere', userId: ben })
    ).toEqual({ ok: false, error: new NotFoundError('Task', 'nowhere') })
  })

  it('returns ValidationError for a missing assignee', async () => {
    const result = await assignTask({ actorId: ada, taskId, userId: '' })

    expect(!result.ok && result.error).toBeInstanceOf(ValidationError)
  })

  it('returns ConflictError when the task changed since it was loaded, keeping the other change', async () => {
    const tasks = await getInjection('ITaskRepository')
    const findById = tasks.findById.bind(tasks)
    vi.spyOn(tasks, 'findById').mockImplementationOnce(async (id) => {
      const stale = await findById(id)
      await assignTask({ actorId: ada, taskId, userId: ada })
      return stale
    })

    expect(await assignTask({ actorId: ada, taskId, userId: ben })).toEqual({
      ok: false,
      error: new ConflictError('Task', taskId),
    })
    expect(await assigneesOf()).toEqual([{ userId: ada, displayName: 'Ada' }])
  })
})

describe('unassignTask', () => {
  beforeEach(async () => {
    await assignTask({ actorId: ada, taskId, userId: ben })
    await assignTask({ actorId: ada, taskId, userId: ada })
  })

  it('unassigns an assignee, keeping the others', async () => {
    const result = await unassignTask({ actorId: ben, taskId, userId: ben })

    expect(result).toEqual({ ok: true, value: undefined })
    expect(await assigneesOf()).toEqual([{ userId: ada, displayName: 'Ada' }])
  })

  it('changes nothing for someone who isn’t assigned', async () => {
    expect(await unassignTask({ actorId: ada, taskId, userId: cy })).toEqual({
      ok: true,
      value: undefined,
    })
    expect(await assigneesOf()).toHaveLength(2)
  })

  it('returns ForbiddenError for an actor who isn’t a Board member', async () => {
    expect(await unassignTask({ actorId: cy, taskId, userId: ben })).toEqual({
      ok: false,
      error: new ForbiddenError(),
    })
    expect(await assigneesOf()).toHaveLength(2)
  })

  it('returns NotFoundError for a task that doesn’t exist', async () => {
    expect(
      await unassignTask({ actorId: ada, taskId: 'nowhere', userId: ben })
    ).toEqual({ ok: false, error: new NotFoundError('Task', 'nowhere') })
  })

  it('returns ValidationError for a missing assignee', async () => {
    const result = await unassignTask({ actorId: ada, taskId, userId: '' })

    expect(!result.ok && result.error).toBeInstanceOf(ValidationError)
  })

  it('returns ConflictError when the task changed since it was loaded', async () => {
    const tasks = await getInjection('ITaskRepository')
    const findById = tasks.findById.bind(tasks)
    vi.spyOn(tasks, 'findById').mockImplementationOnce(async (id) => {
      const stale = await findById(id)
      await unassignTask({ actorId: ada, taskId, userId: ada })
      return stale
    })

    expect(await unassignTask({ actorId: ada, taskId, userId: ben })).toEqual({
      ok: false,
      error: new ConflictError('Task', taskId),
    })
  })
})

/** Makes the task archived, as #73's archive will, through its repository. */
async function archived(id: string) {
  const tasks = await getInjection('ITaskRepository')
  const task = await tasks.findById(toTaskId(id))
  if (!task.ok) throw new Error('setup failed')
  const saved = await tasks.save({ ...task.value, archived: true }, [], {
    actorId: ada,
    causationId: null,
  })
  if (!saved.ok) throw new Error('setup failed')
}

describe('handing assignments over to the Owner', () => {
  let other: string
  let shelved: string

  beforeEach(async () => {
    other = await givenTask('Plan the launch event')
    shelved = await givenTask('Old idea')
    await assignTask({ actorId: ada, taskId, userId: ben })
    await assignTask({ actorId: ada, taskId: other, userId: ada })
    await assignTask({ actorId: ada, taskId: other, userId: ben })
    await assignTask({ actorId: ada, taskId: shelved, userId: ben })
    await archived(shelved)
  })

  it.each([
    ['are removed', () => removeMember({ actorId: ada, boardId, userId: ben })],
    ['leaves', () => leaveBoard({ actorId: ben, boardId })],
  ])(
    'passes a Member’s assignments to the Owner when they %s, archived tasks included, without duplicating the Owner',
    async (_, change) => {
      expect((await change()).ok).toBe(true)
      await (await getInjection('IEventRelay')).drain()

      const owner = [{ userId: ada, displayName: 'Ada' }]
      expect(await assigneesOf(taskId)).toEqual(owner)
      expect(await assigneesOf(other)).toEqual(owner)
      expect(await assigneesOf(shelved)).toEqual(owner)
    }
  )

  it.each([
    [
      'removal',
      () => removeMember({ actorId: ada, boardId, userId: ben }),
      () => ada,
    ],
    ['leaving', () => leaveBoard({ actorId: ben, boardId }), () => ben],
  ])(
    'records each hand-over as a consequence of the %s, by the user who made it',
    async (_, change, actor) => {
      const tasks = await getInjection('ITaskRepository')
      const save = vi.spyOn(tasks, 'save')
      await change()
      await (await getInjection('IEventRelay')).drain()

      const origins = save.mock.calls.map(([, , origin]) => origin)
      expect(origins).toHaveLength(3)
      for (const origin of origins) {
        expect(origin).toEqual({
          actorId: actor(),
          causationId: expect.any(String),
        })
      }
      expect(new Set(origins.map((o) => o.causationId)).size).toBe(1)
    }
  )

  it('passes them to whoever is the Owner when the hand-over runs', async () => {
    await addMember({ actorId: ada, boardId, userId: cy })
    await transferOwnership({ actorId: ada, boardId, userId: cy })
    await removeMember({ actorId: cy, boardId, userId: ben })
    await (await getInjection('IEventRelay')).drain()

    expect(await assigneesOf(taskId)).toEqual([
      { userId: cy, displayName: 'Cy' },
    ])
  })

  it('leaves assignments alone for a Member re-added before the hand-over runs', async () => {
    await removeMember({ actorId: ada, boardId, userId: ben })
    await addMember({ actorId: ada, boardId, userId: ben })
    await (await getInjection('IEventRelay')).drain()

    expect(await assigneesOf(taskId)).toEqual([
      { userId: ben, displayName: 'Ben' },
    ])
  })

  it('hands over from the latest state of a task edited while it ran, keeping the edit', async () => {
    const tasks = await getInjection('ITaskRepository')
    const findAssignedTo = tasks.findAssignedTo.bind(tasks)
    vi.spyOn(tasks, 'findAssignedTo').mockImplementationOnce(
      async (...args) => {
        const stale = await findAssignedTo(...args)
        await renameTask({ actorId: ada, taskId, title: 'Write the memo' })
        return stale
      }
    )
    await removeMember({ actorId: ada, boardId, userId: ben })
    await (await getInjection('IEventRelay')).drain()

    const task = await getTask({ actorId: ada, taskId })
    expect(task.ok && [task.value.title, task.value.assignees]).toEqual([
      'Write the memo',
      [{ userId: ada, displayName: 'Ada' }],
    ])
  })
})
