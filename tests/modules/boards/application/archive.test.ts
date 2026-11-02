import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { getInjection } from '@/di/container'
import {
  addMember,
  archiveBoard,
  archiveList,
  archiveTask,
  BoardArchivedError,
  BoardNameMismatchError,
  ConflictError,
  createBoard,
  createList,
  createTask,
  ForbiddenError,
  getBoard,
  getTask,
  listBoards,
  ListArchivedError,
  ListHasActiveTasksError,
  NotFoundError,
  renameBoard,
  renameList,
  renameTask,
  restoreBoard,
  restoreList,
  restoreTask,
  TaskArchivedError,
  ValidationError,
} from '@/modules/boards/api'
import { resetMockStores } from '@/shared/infrastructure/mock-stores'
import type { UserId } from '@/shared/kernel/user-id'

import { givenUser } from '@tests/fixtures/users'

let ada: UserId
let ben: UserId
let boardId: string
let backlog: string
let done: string

beforeEach(async () => {
  resetMockStores()
  ada = await givenUser('Ada', 'ada@example.com')
  ben = await givenUser('Ben', 'ben@example.com')
  const created = await createBoard({ actorId: ada, name: 'Launch plan' })
  if (!created.ok) throw new Error('setup failed')
  boardId = created.value.boardId
  const added = await addMember({ actorId: ada, boardId, userId: ben })
  if (!added.ok) throw new Error('setup failed')
  backlog = await givenList('Backlog')
  done = await givenList('Done')
})

afterEach(() => {
  vi.restoreAllMocks()
})

async function givenList(name: string): Promise<string> {
  const created = await createList({ actorId: ada, boardId, name })
  if (!created.ok) throw new Error('setup failed')
  return created.value.listId
}

async function givenTask(listId: string, title: string): Promise<string> {
  const created = await createTask({ actorId: ada, listId, title })
  if (!created.ok) throw new Error('setup failed')
  return created.value.taskId
}

/** The board's lists and their tasks' titles, in the given view. */
async function view(which: 'active' | 'archived', actorId = ada) {
  const board = await getBoard({ actorId, boardId, view: which })
  if (!board.ok) throw new Error('read failed')
  return board.value.lists.map((list) => ({
    name: list.name,
    archived: list.archived,
    tasks: list.tasks.map((task) => task.title),
  }))
}

async function boardNames(which?: 'active' | 'archived', actorId = ada) {
  const boards = await listBoards({
    actorId,
    ...(which ? { view: which } : {}),
  })
  return boards.ok ? boards.value.map((board) => board.name) : undefined
}

describe('archiveBoard', () => {
  it('moves the board from the Active to the Archived view for every Board member', async () => {
    const result = await archiveBoard({
      actorId: ada,
      boardId,
      confirmName: 'Launch plan',
    })

    expect(result).toEqual({ ok: true, value: undefined })
    expect(await boardNames()).toEqual([])
    expect(await boardNames('active', ben)).toEqual([])
    expect(await boardNames('archived', ben)).toEqual(['Launch plan'])
  })

  it('leaves its lists and tasks as they were, so a restore brings everything back', async () => {
    await givenTask(backlog, 'Write the brief')
    await archiveBoard({ actorId: ada, boardId, confirmName: 'Launch plan' })

    const restored = await restoreBoard({ actorId: ada, boardId })

    expect(restored).toEqual({ ok: true, value: undefined })
    expect(await boardNames()).toEqual(['Launch plan'])
    expect(await view('active')).toEqual([
      { name: 'Backlog', archived: false, tasks: ['Write the brief'] },
      { name: 'Done', archived: false, tasks: [] },
    ])
  })

  it('keeps the archived board readable, and marked archived', async () => {
    await archiveBoard({ actorId: ada, boardId, confirmName: 'Launch plan' })

    const board = await getBoard({ actorId: ben, boardId })

    expect(board.ok && board.value.archived).toBe(true)
  })

  it('returns BoardNameMismatchError when the typed name isn’t the board’s', async () => {
    const result = await archiveBoard({
      actorId: ada,
      boardId,
      confirmName: 'Launch',
    })

    expect(result).toEqual({ ok: false, error: new BoardNameMismatchError() })
    expect(await boardNames()).toEqual(['Launch plan'])
  })

  it('returns ValidationError when no name is typed', async () => {
    const result = await archiveBoard({
      actorId: ada,
      boardId,
      confirmName: '',
    })

    expect(!result.ok && result.error).toBeInstanceOf(ValidationError)
  })

  it('returns ForbiddenError to a Member', async () => {
    const result = await archiveBoard({
      actorId: ben,
      boardId,
      confirmName: 'Launch plan',
    })

    expect(result).toEqual({ ok: false, error: new ForbiddenError() })
    expect(await boardNames()).toEqual(['Launch plan'])
  })

  it('returns NotFoundError for a missing board', async () => {
    const result = await archiveBoard({
      actorId: ada,
      boardId: 'nowhere',
      confirmName: 'Launch plan',
    })

    expect(result).toEqual({
      ok: false,
      error: new NotFoundError('Board', 'nowhere'),
    })
  })

  it('returns ConflictError when the board changed since it was loaded', async () => {
    const boards = await getInjection('IBoardRepository')
    const stale = await boards.findById(boardId as never)
    await renameBoard({ actorId: ada, boardId, name: 'Launch' })
    vi.spyOn(boards, 'findById').mockResolvedValueOnce(stale)

    const result = await archiveBoard({
      actorId: ada,
      boardId,
      confirmName: 'Launch plan',
    })

    expect(result).toEqual({
      ok: false,
      error: new ConflictError('Board', boardId),
    })
  })

  it('makes the board read-only until it is restored', async () => {
    await archiveBoard({ actorId: ada, boardId, confirmName: 'Launch plan' })

    expect(await renameBoard({ actorId: ada, boardId, name: 'Q3' })).toEqual({
      ok: false,
      error: new BoardArchivedError(),
    })
  })
})

describe('restoreBoard', () => {
  beforeEach(async () => {
    await archiveBoard({ actorId: ada, boardId, confirmName: 'Launch plan' })
  })

  it('returns ForbiddenError to a Member', async () => {
    expect(await restoreBoard({ actorId: ben, boardId })).toEqual({
      ok: false,
      error: new ForbiddenError(),
    })
    expect(await boardNames('archived')).toEqual(['Launch plan'])
  })

  it('returns NotFoundError for a missing board', async () => {
    expect(await restoreBoard({ actorId: ada, boardId: 'nowhere' })).toEqual({
      ok: false,
      error: new NotFoundError('Board', 'nowhere'),
    })
  })

  it('returns ValidationError for a missing board id', async () => {
    const result = await restoreBoard({ actorId: ada, boardId: '' })

    expect(!result.ok && result.error).toBeInstanceOf(ValidationError)
  })
})

describe('archiveTask and restoreTask', () => {
  it('hides an archived task from the Active view and shows it in the Archived view', async () => {
    const taskId = await givenTask(backlog, 'Write the brief')
    await givenTask(backlog, 'Book the venue')

    const result = await archiveTask({ actorId: ben, taskId })

    expect(result).toEqual({ ok: true, value: undefined })
    expect(await view('active')).toEqual([
      { name: 'Backlog', archived: false, tasks: ['Book the venue'] },
      { name: 'Done', archived: false, tasks: [] },
    ])
    expect(await view('archived')).toEqual([
      { name: 'Backlog', archived: false, tasks: ['Write the brief'] },
    ])
    const task = await getTask({ actorId: ada, taskId })
    expect(task.ok && task.value.archived).toBe(true)
  })

  it('restores a task to its old place', async () => {
    const [first] = [
      await givenTask(backlog, 'Write the brief'),
      await givenTask(backlog, 'Book the venue'),
    ]
    if (!first) throw new Error('setup failed')
    await archiveTask({ actorId: ada, taskId: first })

    const result = await restoreTask({ actorId: ben, taskId: first })

    expect(result).toEqual({ ok: true, value: undefined })
    expect(await view('active')).toEqual([
      {
        name: 'Backlog',
        archived: false,
        tasks: ['Write the brief', 'Book the venue'],
      },
      { name: 'Done', archived: false, tasks: [] },
    ])
    expect(await view('archived')).toEqual([])
  })

  it('makes an archived task read-only', async () => {
    const taskId = await givenTask(backlog, 'Write the brief')
    await archiveTask({ actorId: ada, taskId })

    expect(await renameTask({ actorId: ada, taskId, title: 'New' })).toEqual({
      ok: false,
      error: new TaskArchivedError(),
    })
  })

  it('returns ListArchivedError when restoring into an archived list', async () => {
    const taskId = await givenTask(done, 'Ship it')
    await archiveTask({ actorId: ada, taskId })
    await archiveList({ actorId: ada, listId: done })

    expect(await restoreTask({ actorId: ada, taskId })).toEqual({
      ok: false,
      error: new ListArchivedError(),
    })
  })

  it.each([
    ['archiveTask', archiveTask],
    ['restoreTask', restoreTask],
  ])(
    '%s returns ForbiddenError to a user who isn’t a Board member',
    async (_name, command) => {
      const taskId = await givenTask(backlog, 'Write the brief')
      const cy = await givenUser('Cy', 'cy@example.com')

      expect(await command({ actorId: cy, taskId })).toEqual({
        ok: false,
        error: new ForbiddenError(),
      })
    }
  )

  it.each([
    ['archiveTask', archiveTask],
    ['restoreTask', restoreTask],
  ])('%s returns NotFoundError for a missing task', async (_name, command) => {
    expect(await command({ actorId: ada, taskId: 'nowhere' })).toEqual({
      ok: false,
      error: new NotFoundError('Task', 'nowhere'),
    })
  })

  it('returns ValidationError for a missing task id', async () => {
    const result = await archiveTask({ actorId: ada, taskId: '' })

    expect(!result.ok && result.error).toBeInstanceOf(ValidationError)
  })

  it('returns ConflictError when the task changed since it was loaded', async () => {
    const taskId = await givenTask(backlog, 'Write the brief')
    const tasks = await getInjection('ITaskRepository')
    const stale = await tasks.findById(taskId as never)
    await renameTask({ actorId: ada, taskId, title: 'Brief' })
    vi.spyOn(tasks, 'findById').mockResolvedValueOnce(stale)

    expect(await archiveTask({ actorId: ada, taskId })).toEqual({
      ok: false,
      error: new ConflictError('Task', taskId),
    })
  })
})

describe('archiveList and restoreList', () => {
  it('archives a list with no active tasks, hiding it from the Active view', async () => {
    const taskId = await givenTask(done, 'Ship it')
    await archiveTask({ actorId: ada, taskId })

    const result = await archiveList({ actorId: ben, listId: done })

    expect(result).toEqual({ ok: true, value: undefined })
    expect(await view('active')).toEqual([
      { name: 'Backlog', archived: false, tasks: [] },
    ])
    expect(await view('archived')).toEqual([
      { name: 'Done', archived: true, tasks: ['Ship it'] },
    ])
  })

  it('returns ListHasActiveTasksError while any of its tasks is active', async () => {
    await givenTask(done, 'Ship it')

    expect(await archiveList({ actorId: ada, listId: done })).toEqual({
      ok: false,
      error: new ListHasActiveTasksError(),
    })
    expect((await view('active')).map((list) => list.name)).toEqual([
      'Backlog',
      'Done',
    ])
  })

  it('restores a list in its old place, without restoring its tasks', async () => {
    const taskId = await givenTask(backlog, 'Old idea')
    await archiveTask({ actorId: ada, taskId })
    await archiveList({ actorId: ada, listId: backlog })

    const result = await restoreList({ actorId: ben, listId: backlog })

    expect(result).toEqual({ ok: true, value: undefined })
    expect(await view('active')).toEqual([
      { name: 'Backlog', archived: false, tasks: [] },
      { name: 'Done', archived: false, tasks: [] },
    ])
    expect(await view('archived')).toEqual([
      { name: 'Backlog', archived: false, tasks: ['Old idea'] },
    ])
  })

  it('makes an archived list read-only', async () => {
    await archiveList({ actorId: ada, listId: done })

    expect(
      await renameList({ actorId: ada, listId: done, name: 'Shipped' })
    ).toEqual({ ok: false, error: new ListArchivedError() })
  })

  it.each([
    ['archiveList', archiveList],
    ['restoreList', restoreList],
  ])(
    '%s returns ForbiddenError to a user who isn’t a Board member',
    async (_name, command) => {
      const cy = await givenUser('Cy', 'cy@example.com')

      expect(await command({ actorId: cy, listId: done })).toEqual({
        ok: false,
        error: new ForbiddenError(),
      })
    }
  )

  it.each([
    ['archiveList', archiveList],
    ['restoreList', restoreList],
  ])('%s returns NotFoundError for a missing list', async (_name, command) => {
    expect(await command({ actorId: ada, listId: 'nowhere' })).toEqual({
      ok: false,
      error: new NotFoundError('List', 'nowhere'),
    })
  })

  it('returns ValidationError for a missing list id', async () => {
    const result = await restoreList({ actorId: ada, listId: '' })

    expect(!result.ok && result.error).toBeInstanceOf(ValidationError)
  })

  it('returns ConflictError when the list changed since it was loaded', async () => {
    const lists = await getInjection('IListRepository')
    const stale = await lists.findById(done as never)
    await renameList({ actorId: ada, listId: done, name: 'Shipped' })
    vi.spyOn(lists, 'findById').mockResolvedValueOnce(stale)

    expect(await archiveList({ actorId: ada, listId: done })).toEqual({
      ok: false,
      error: new ConflictError('List', done),
    })
  })
})

describe('the board views', () => {
  it('default to Active', async () => {
    await archiveList({ actorId: ada, listId: done })

    const board = await getBoard({ actorId: ada, boardId })

    expect(board.ok && board.value.lists.map((list) => list.name)).toEqual([
      'Backlog',
    ])
  })

  it('return ValidationError for an unknown view', async () => {
    const result = await getBoard({
      actorId: ada,
      boardId,
      view: 'deleted' as never,
    })

    expect(!result.ok && result.error).toBeInstanceOf(ValidationError)
  })
})
