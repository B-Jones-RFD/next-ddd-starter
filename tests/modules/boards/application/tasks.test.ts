import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { getInjection } from '@/di/container'
import {
  addMember,
  changeTaskDescription,
  ConflictError,
  createBoard,
  createList,
  createTask,
  ForbiddenError,
  getBoard,
  getTask,
  ListArchivedError,
  moveTask,
  NotFoundError,
  renameTask,
  reorderTask,
  ValidationError,
} from '@/modules/boards/api'
import { resetMockStores } from '@/shared/infrastructure/mock-stores'
import type { UserId } from '@/shared/kernel/user-id'

import { givenUser } from '@tests/fixtures/users'

let ada: UserId
let boardId: string
let backlog: string
let done: string

beforeEach(async () => {
  resetMockStores()
  ada = await givenUser('Ada')
  const created = await createBoard({ actorId: ada, name: 'Launch plan' })
  if (!created.ok) throw new Error('setup failed')
  boardId = created.value.boardId
  backlog = await givenList('Backlog')
  done = await givenList('Done')
})

afterEach(() => {
  vi.restoreAllMocks()
})

async function givenList(name: string, id = boardId): Promise<string> {
  const created = await createList({ actorId: ada, boardId: id, name })
  if (!created.ok) throw new Error('setup failed')
  return created.value.listId
}

/** Creates tasks in a list, in order, and returns their ids. */
async function givenTasks(listId: string, ...titles: string[]) {
  const ids: string[] = []
  for (const title of titles) {
    const created = await createTask({ actorId: ada, listId, title })
    if (!created.ok) throw new Error('setup failed')
    ids.push(created.value.taskId)
  }
  return ids
}

/** Each list's task titles, in board order. */
async function titles() {
  const board = await getBoard({ actorId: ada, boardId })
  if (!board.ok) throw new Error('read failed')
  return Object.fromEntries(
    board.value.lists.map((list) => [
      list.name,
      list.tasks.map((task) => task.title),
    ])
  )
}

/** Makes the list read as archived from now on, as if just archived. */
async function archivedFromNow(listId: string) {
  const lists = await getInjection('IListRepository')
  const findById = lists.findById.bind(lists)
  vi.spyOn(lists, 'findById').mockImplementation(async (id) => {
    const found = await findById(id)
    return found.ok && id === listId
      ? { ok: true, value: { ...found.value, archived: true } }
      : found
  })
}

describe('createTask', () => {
  it('adds a task to the end of its list', async () => {
    await givenTasks(backlog, 'First')

    const result = await createTask({
      actorId: ada,
      listId: backlog,
      title: ' Second ',
    })

    expect(result).toEqual({ ok: true, value: { taskId: expect.any(String) } })
    expect(await titles()).toEqual({ Backlog: ['First', 'Second'], Done: [] })
  })

  it('lets a Member add a task', async () => {
    const ben = await givenUser('Ben')
    await addMember({ actorId: ada, boardId, userId: ben })

    const result = await createTask({ actorId: ben, listId: done, title: 'X' })

    expect(result.ok).toBe(true)
  })

  it('returns ValidationError for an empty title, creating nothing', async () => {
    const result = await createTask({
      actorId: ada,
      listId: backlog,
      title: '',
    })

    expect(!result.ok && result.error).toEqual(
      new ValidationError({ title: 'required' })
    )
    expect(await titles()).toEqual({ Backlog: [], Done: [] })
  })

  it('returns ForbiddenError for a user who isn’t a Board member', async () => {
    const cy = await givenUser('Cy')

    expect(
      await createTask({ actorId: cy, listId: backlog, title: 'Mine' })
    ).toEqual({ ok: false, error: new ForbiddenError() })
    expect(await titles()).toEqual({ Backlog: [], Done: [] })
  })

  it('returns NotFoundError for a list that doesn’t exist', async () => {
    expect(
      await createTask({ actorId: ada, listId: 'nowhere', title: 'X' })
    ).toEqual({ ok: false, error: new NotFoundError('List', 'nowhere') })
  })

  it('returns ListArchivedError for a list archived meanwhile', async () => {
    await archivedFromNow(backlog)

    expect(
      await createTask({ actorId: ada, listId: backlog, title: 'X' })
    ).toEqual({ ok: false, error: new ListArchivedError() })
  })
})

describe('renameTask', () => {
  it('renames a task', async () => {
    const [task = ''] = await givenTasks(backlog, 'Draft')

    const result = await renameTask({
      actorId: ada,
      taskId: task,
      title: 'Final',
    })

    expect(result).toEqual({ ok: true, value: undefined })
    expect(await titles()).toEqual({ Backlog: ['Final'], Done: [] })
  })

  it('returns ValidationError for a title that’s too long, changing nothing', async () => {
    const [task = ''] = await givenTasks(backlog, 'Draft')

    const result = await renameTask({
      actorId: ada,
      taskId: task,
      title: 'x'.repeat(201),
    })

    expect(!result.ok && result.error).toEqual(
      new ValidationError({ title: 'too-long' })
    )
    expect(await titles()).toEqual({ Backlog: ['Draft'], Done: [] })
  })

  it('returns ForbiddenError for a user who isn’t a Board member', async () => {
    const [task = ''] = await givenTasks(backlog, 'Draft')
    const cy = await givenUser('Cy')

    expect(
      await renameTask({ actorId: cy, taskId: task, title: 'Mine' })
    ).toEqual({ ok: false, error: new ForbiddenError() })
  })

  it('returns NotFoundError for a task that doesn’t exist', async () => {
    expect(
      await renameTask({ actorId: ada, taskId: 'nowhere', title: 'X' })
    ).toEqual({ ok: false, error: new NotFoundError('Task', 'nowhere') })
  })

  it('returns ConflictError when the task changed since it was loaded, keeping the other change', async () => {
    const [task = ''] = await givenTasks(backlog, 'Draft')
    const tasks = await getInjection('ITaskRepository')
    const findById = tasks.findById.bind(tasks)
    vi.spyOn(tasks, 'findById').mockImplementationOnce(async (id) => {
      const stale = await findById(id)
      await renameTask({ actorId: ada, taskId: task, title: 'Theirs' })
      return stale
    })

    expect(
      await renameTask({ actorId: ada, taskId: task, title: 'Mine' })
    ).toEqual({ ok: false, error: new ConflictError('Task', task) })
    expect(await titles()).toEqual({ Backlog: ['Theirs'], Done: [] })
  })
})

describe('changeTaskDescription', () => {
  it('changes a task’s description, as getTask shows', async () => {
    const [task = ''] = await givenTasks(backlog, 'Draft')

    const result = await changeTaskDescription({
      actorId: ada,
      taskId: task,
      description: 'One page.',
    })

    expect(result).toEqual({ ok: true, value: undefined })
    const found = await getTask({ actorId: ada, taskId: task })
    expect(found.ok && found.value.description).toBe('One page.')
  })

  it('returns ValidationError for a description that’s too long', async () => {
    const [task = ''] = await givenTasks(backlog, 'Draft')

    const result = await changeTaskDescription({
      actorId: ada,
      taskId: task,
      description: 'x'.repeat(5001),
    })

    expect(!result.ok && result.error).toEqual(
      new ValidationError({ description: 'too-long' })
    )
  })

  it('returns ForbiddenError for a user who isn’t a Board member', async () => {
    const [task = ''] = await givenTasks(backlog, 'Draft')
    const cy = await givenUser('Cy')

    expect(
      await changeTaskDescription({
        actorId: cy,
        taskId: task,
        description: 'Mine',
      })
    ).toEqual({ ok: false, error: new ForbiddenError() })
  })

  it('returns NotFoundError for a task that doesn’t exist', async () => {
    expect(
      await changeTaskDescription({
        actorId: ada,
        taskId: 'nowhere',
        description: 'X',
      })
    ).toEqual({ ok: false, error: new NotFoundError('Task', 'nowhere') })
  })
})

describe('reorderTask', () => {
  let one = ''
  let two = ''
  let three = ''

  beforeEach(async () => {
    ;[one = '', two = '', three = ''] = await givenTasks(
      backlog,
      'One',
      'Two',
      'Three'
    )
  })

  it('moves a task down, between its new neighbours', async () => {
    const result = await reorderTask({
      actorId: ada,
      taskId: one,
      after: two,
      before: three,
    })

    expect(result).toEqual({ ok: true, value: undefined })
    expect((await titles()).Backlog).toEqual(['Two', 'One', 'Three'])
  })

  it('moves a task first and last', async () => {
    await reorderTask({ actorId: ada, taskId: three, before: one })
    expect((await titles()).Backlog).toEqual(['Three', 'One', 'Two'])

    await reorderTask({ actorId: ada, taskId: three, after: two })
    expect((await titles()).Backlog).toEqual(['One', 'Two', 'Three'])
  })

  it('returns ConflictError for neighbours out of order, as from a stale page', async () => {
    expect(
      await reorderTask({
        actorId: ada,
        taskId: one,
        after: three,
        before: two,
      })
    ).toEqual({ ok: false, error: new ConflictError('Task', one) })
  })

  it('returns NotFoundError for a neighbour in another list', async () => {
    const [elsewhere = ''] = await givenTasks(done, 'Elsewhere')

    expect(
      await reorderTask({ actorId: ada, taskId: one, after: elsewhere })
    ).toEqual({ ok: false, error: new NotFoundError('Task', elsewhere) })
  })

  it('returns ForbiddenError for a user who isn’t a Board member', async () => {
    const cy = await givenUser('Cy')

    expect(
      await reorderTask({ actorId: cy, taskId: one, after: three })
    ).toEqual({ ok: false, error: new ForbiddenError() })
    expect((await titles()).Backlog).toEqual(['One', 'Two', 'Three'])
  })

  it('returns NotFoundError for a task that doesn’t exist', async () => {
    expect(
      await reorderTask({ actorId: ada, taskId: 'nowhere', after: one })
    ).toEqual({ ok: false, error: new NotFoundError('Task', 'nowhere') })
  })
})

describe('moveTask', () => {
  let task = ''
  let shipped = ''

  beforeEach(async () => {
    ;[task = ''] = await givenTasks(backlog, 'Write the brief')
    ;[shipped = ''] = await givenTasks(done, 'Shipped')
  })

  it('moves a task to another list, at the chosen place', async () => {
    const result = await moveTask({
      actorId: ada,
      taskId: task,
      toListId: done,
      before: shipped,
    })

    expect(result).toEqual({ ok: true, value: undefined })
    expect(await titles()).toEqual({
      Backlog: [],
      Done: ['Write the brief', 'Shipped'],
    })
    const found = await getTask({ actorId: ada, taskId: task })
    expect(found.ok && found.value.listName).toBe('Done')
  })

  it('moves a task to the bottom of another list', async () => {
    await moveTask({
      actorId: ada,
      taskId: task,
      toListId: done,
      after: shipped,
    })

    expect((await titles()).Done).toEqual(['Shipped', 'Write the brief'])
  })

  it('writes only the moved task, so a concurrent edit of a neighbour doesn’t conflict', async () => {
    const tasks = await getInjection('ITaskRepository')
    const findById = tasks.findById.bind(tasks)
    // Someone renames the neighbour while this move is loading.
    vi.spyOn(tasks, 'findById').mockImplementationOnce(async (id) => {
      const loaded = await findById(id)
      await renameTask({ actorId: ada, taskId: shipped, title: 'Released' })
      return loaded
    })

    const result = await moveTask({
      actorId: ada,
      taskId: task,
      toListId: done,
      after: shipped,
    })

    expect(result).toEqual({ ok: true, value: undefined })
    expect((await titles()).Done).toEqual(['Released', 'Write the brief'])
  })

  it('returns ListArchivedError for a list archived meanwhile, moving nothing', async () => {
    await archivedFromNow(done)

    expect(
      await moveTask({ actorId: ada, taskId: task, toListId: done })
    ).toEqual({ ok: false, error: new ListArchivedError() })
    vi.restoreAllMocks()
    expect((await titles()).Backlog).toEqual(['Write the brief'])
  })

  it('returns NotFoundError for a list on another board', async () => {
    const other = await createBoard({ actorId: ada, name: 'Other' })
    if (!other.ok) throw new Error('setup failed')
    const elsewhere = await givenList('Elsewhere', other.value.boardId)

    expect(
      await moveTask({ actorId: ada, taskId: task, toListId: elsewhere })
    ).toEqual({ ok: false, error: new NotFoundError('List', elsewhere) })
  })

  it('returns NotFoundError for a list that doesn’t exist', async () => {
    expect(
      await moveTask({ actorId: ada, taskId: task, toListId: 'nowhere' })
    ).toEqual({ ok: false, error: new NotFoundError('List', 'nowhere') })
  })

  it('returns ForbiddenError for a user who isn’t a Board member', async () => {
    const cy = await givenUser('Cy')

    expect(
      await moveTask({ actorId: cy, taskId: task, toListId: done })
    ).toEqual({ ok: false, error: new ForbiddenError() })
  })

  it('returns ConflictError when the task moved since it was loaded', async () => {
    const tasks = await getInjection('ITaskRepository')
    const findById = tasks.findById.bind(tasks)
    vi.spyOn(tasks, 'findById').mockImplementationOnce(async (id) => {
      const stale = await findById(id)
      await moveTask({ actorId: ada, taskId: task, toListId: done })
      return stale
    })

    expect(
      await moveTask({
        actorId: ada,
        taskId: task,
        toListId: done,
        before: shipped,
      })
    ).toEqual({ ok: false, error: new ConflictError('Task', task) })
  })
})

describe('getTask', () => {
  it('gives a Board member the task with its board and list', async () => {
    const [task = ''] = await givenTasks(backlog, 'Write the brief')

    expect(await getTask({ actorId: ada, taskId: task })).toEqual({
      ok: true,
      value: {
        id: task,
        title: 'Write the brief',
        description: '',
        archived: false,
        boardId,
        boardName: 'Launch plan',
        listId: backlog,
        listName: 'Backlog',
        tags: [],
        assignees: [],
      },
    })
  })

  it('returns ForbiddenError for a user who isn’t a Board member', async () => {
    const [task = ''] = await givenTasks(backlog, 'Write the brief')
    const cy = await givenUser('Cy')

    expect(await getTask({ actorId: cy, taskId: task })).toEqual({
      ok: false,
      error: new ForbiddenError(),
    })
  })

  it('returns NotFoundError for a task that doesn’t exist', async () => {
    expect(await getTask({ actorId: ada, taskId: 'nowhere' })).toEqual({
      ok: false,
      error: new NotFoundError('Task', 'nowhere'),
    })
  })
})
