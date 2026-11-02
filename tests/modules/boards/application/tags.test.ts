import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { getInjection } from '@/di/container'
import {
  addMember,
  ConflictError,
  createBoard,
  createList,
  createTag,
  createTask,
  deleteTag,
  ForbiddenError,
  getBoard,
  getTask,
  listTags,
  NotFoundError,
  recolorTag,
  renameTag,
  TagNameTakenError,
  tagTask,
  untagTask,
  ValidationError,
} from '@/modules/boards/api'
import { untagDeletedTag } from '@/modules/boards/application/handlers/untag-deleted-tag'
import { resetMockStores } from '@/shared/infrastructure/mock-stores'
import { MockOutbox } from '@/shared/infrastructure/outbox/outbox.mock'
import type { UserId } from '@/shared/kernel/user-id'

import { givenUser } from '@tests/fixtures/users'

let ada: UserId
let ben: UserId
let boardId: string
let listId: string

beforeEach(async () => {
  resetMockStores()
  ada = await givenUser('Ada')
  ben = await givenUser('Ben')
  boardId = await givenBoard('Launch plan')
  await addMember({ actorId: ada, boardId, userId: ben })
  const list = await createList({ actorId: ada, boardId, name: 'Backlog' })
  if (!list.ok) throw new Error('setup failed')
  listId = list.value.listId
})

afterEach(() => {
  vi.restoreAllMocks()
})

async function givenBoard(name: string): Promise<string> {
  const created = await createBoard({ actorId: ada, name })
  if (!created.ok) throw new Error('setup failed')
  return created.value.boardId
}

async function givenTag(name: string, color = 'blue', on = boardId) {
  const created = await createTag({ actorId: ada, boardId: on, name, color })
  if (!created.ok) throw new Error('setup failed')
  return created.value.tagId
}

async function givenTask(title: string) {
  const created = await createTask({ actorId: ada, listId, title })
  if (!created.ok) throw new Error('setup failed')
  return created.value.taskId
}

/** The board's tags as `name:color`, as `listTags` gives them. */
async function tags() {
  const listed = await listTags({ actorId: ada, boardId })
  if (!listed.ok) throw new Error('read failed')
  return listed.value.map((tag) => `${tag.name}:${tag.color}`)
}

/** Each task's tag names, by title, as the board shows them. */
async function taskTags() {
  const board = await getBoard({ actorId: ada, boardId })
  if (!board.ok) throw new Error('read failed')
  return Object.fromEntries(
    board.value.lists
      .flatMap((list) => list.tasks)
      .map((task) => [task.title, task.tags.map((tag) => tag.name)])
  )
}

describe('createTag', () => {
  it('lets a Member define a tag, which listTags shows by name', async () => {
    await givenTag('Urgent', 'red')

    const result = await createTag({
      actorId: ben,
      boardId,
      name: ' design ',
      color: 'teal',
    })

    expect(result).toEqual({ ok: true, value: { tagId: expect.any(String) } })
    expect(await tags()).toEqual(['design:teal', 'Urgent:red'])
  })

  it('returns TagNameTakenError for a name already on the board', async () => {
    await givenTag('Urgent')

    expect(
      await createTag({ actorId: ben, boardId, name: 'URGENT', color: 'red' })
    ).toEqual({ ok: false, error: new TagNameTakenError() })
  })

  it('allows the same name on another board', async () => {
    await givenTag('Urgent')
    const other = await givenBoard('Other')

    const result = await createTag({
      actorId: ada,
      boardId: other,
      name: 'Urgent',
      color: 'red',
    })

    expect(result.ok).toBe(true)
  })

  it('returns ValidationError for an empty name and a color outside the palette', async () => {
    expect(
      await createTag({ actorId: ada, boardId, name: '', color: 'pink' })
    ).toEqual({
      ok: false,
      error: new ValidationError({ name: 'required', color: 'invalid' }),
    })
    expect(await tags()).toEqual([])
  })

  it('returns ForbiddenError for a user who isn’t a Board member', async () => {
    const cy = await givenUser('Cy')

    expect(
      await createTag({ actorId: cy, boardId, name: 'Mine', color: 'red' })
    ).toEqual({ ok: false, error: new ForbiddenError() })
  })

  it('returns NotFoundError for a board that doesn’t exist', async () => {
    expect(
      await createTag({
        actorId: ada,
        boardId: 'nowhere',
        name: 'X',
        color: 'red',
      })
    ).toEqual({ ok: false, error: new NotFoundError('Board', 'nowhere') })
  })

  it('returns ConflictError when the board changed since it was loaded', async () => {
    const boards = await getInjection('IBoardRepository')
    const findById = boards.findById.bind(boards)
    vi.spyOn(boards, 'findById').mockImplementationOnce(async (id) => {
      const stale = await findById(id)
      await givenTag('Theirs')
      return stale
    })

    expect(
      await createTag({ actorId: ada, boardId, name: 'Mine', color: 'red' })
    ).toEqual({ ok: false, error: new ConflictError('Board', boardId) })
    expect(await tags()).toEqual(['Theirs:blue'])
  })
})

describe('renameTag', () => {
  it('renames a tag, everywhere it shows', async () => {
    const tagId = await givenTag('Urgent', 'red')
    const taskId = await givenTask('Write the brief')
    await tagTask({ actorId: ada, taskId, tagId })

    const result = await renameTag({
      actorId: ben,
      tagId,
      boardId,
      name: 'Now',
    })

    expect(result).toEqual({ ok: true, value: undefined })
    expect(await tags()).toEqual(['Now:red'])
    expect(await taskTags()).toEqual({ 'Write the brief': ['Now'] })
  })

  it('returns TagNameTakenError for another tag’s name', async () => {
    await givenTag('Urgent')
    const tagId = await givenTag('Later')

    expect(
      await renameTag({ actorId: ada, boardId, tagId, name: 'urgent' })
    ).toEqual({ ok: false, error: new TagNameTakenError() })
  })

  it('returns ValidationError for a name that’s too long', async () => {
    const tagId = await givenTag('Urgent')

    expect(
      await renameTag({ actorId: ada, boardId, tagId, name: 'x'.repeat(61) })
    ).toEqual({ ok: false, error: new ValidationError({ name: 'too-long' }) })
  })

  it('returns NotFoundError for a tag on another board', async () => {
    const other = await givenBoard('Other')
    const tagId = await givenTag('Elsewhere', 'red', other)

    expect(
      await renameTag({ actorId: ada, boardId, tagId, name: 'X' })
    ).toEqual({ ok: false, error: new NotFoundError('Tag', tagId) })
  })

  it('returns ForbiddenError for a user who isn’t a Board member', async () => {
    const tagId = await givenTag('Urgent')
    const cy = await givenUser('Cy')

    expect(
      await renameTag({ actorId: cy, boardId, tagId, name: 'Mine' })
    ).toEqual({ ok: false, error: new ForbiddenError() })
  })
})

describe('recolorTag', () => {
  it('gives a tag another Tag color', async () => {
    const tagId = await givenTag('Urgent', 'red')

    const result = await recolorTag({
      actorId: ben,
      boardId,
      tagId,
      color: 'amber',
    })

    expect(result).toEqual({ ok: true, value: undefined })
    expect(await tags()).toEqual(['Urgent:amber'])
  })

  it('returns ValidationError for a color outside the palette', async () => {
    const tagId = await givenTag('Urgent', 'red')

    expect(
      await recolorTag({ actorId: ada, boardId, tagId, color: '#ff0000' })
    ).toEqual({ ok: false, error: new ValidationError({ color: 'invalid' }) })
  })

  it('returns NotFoundError for a tag that doesn’t exist', async () => {
    expect(
      await recolorTag({ actorId: ada, boardId, tagId: 'gone', color: 'red' })
    ).toEqual({ ok: false, error: new NotFoundError('Tag', 'gone') })
  })

  it('returns ForbiddenError for a user who isn’t a Board member', async () => {
    const tagId = await givenTag('Urgent')
    const cy = await givenUser('Cy')

    expect(
      await recolorTag({ actorId: cy, boardId, tagId, color: 'red' })
    ).toEqual({ ok: false, error: new ForbiddenError() })
  })
})

describe('tagTask and untagTask', () => {
  it('attaches tags to a task, which the board and the task show by name', async () => {
    const urgent = await givenTag('Urgent', 'red')
    const design = await givenTag('Design', 'teal')
    const taskId = await givenTask('Write the brief')

    expect(await tagTask({ actorId: ben, taskId, tagId: urgent })).toEqual({
      ok: true,
      value: undefined,
    })
    await tagTask({ actorId: ben, taskId, tagId: design })

    expect(await taskTags()).toEqual({
      'Write the brief': ['Design', 'Urgent'],
    })
    const task = await getTask({ actorId: ben, taskId })
    expect(task.ok && task.value.tags).toEqual([
      { id: design, name: 'Design', color: 'teal' },
      { id: urgent, name: 'Urgent', color: 'red' },
    ])
  })

  it('detaches a tag from a task', async () => {
    const urgent = await givenTag('Urgent')
    const taskId = await givenTask('Write the brief')
    await tagTask({ actorId: ada, taskId, tagId: urgent })

    expect(await untagTask({ actorId: ben, taskId, tagId: urgent })).toEqual({
      ok: true,
      value: undefined,
    })

    expect(await taskTags()).toEqual({ 'Write the brief': [] })
  })

  it('returns NotFoundError for a tag from another board', async () => {
    const other = await givenBoard('Other')
    const elsewhere = await givenTag('Elsewhere', 'red', other)
    const taskId = await givenTask('Write the brief')

    expect(await tagTask({ actorId: ada, taskId, tagId: elsewhere })).toEqual({
      ok: false,
      error: new NotFoundError('Tag', elsewhere),
    })
    expect(await taskTags()).toEqual({ 'Write the brief': [] })
  })

  it('returns ForbiddenError for a user who isn’t a Board member', async () => {
    const urgent = await givenTag('Urgent')
    const taskId = await givenTask('Write the brief')
    const cy = await givenUser('Cy')

    expect(await tagTask({ actorId: cy, taskId, tagId: urgent })).toEqual({
      ok: false,
      error: new ForbiddenError(),
    })
    expect(await untagTask({ actorId: cy, taskId, tagId: urgent })).toEqual({
      ok: false,
      error: new ForbiddenError(),
    })
  })

  it('returns NotFoundError for a task that doesn’t exist', async () => {
    const urgent = await givenTag('Urgent')

    expect(
      await tagTask({ actorId: ada, taskId: 'nowhere', tagId: urgent })
    ).toEqual({ ok: false, error: new NotFoundError('Task', 'nowhere') })
  })

  it('returns ConflictError when the task changed since it was loaded', async () => {
    const urgent = await givenTag('Urgent')
    const design = await givenTag('Design')
    const taskId = await givenTask('Write the brief')
    const tasks = await getInjection('ITaskRepository')
    const findById = tasks.findById.bind(tasks)
    vi.spyOn(tasks, 'findById').mockImplementationOnce(async (id) => {
      const stale = await findById(id)
      await tagTask({ actorId: ben, taskId, tagId: design })
      return stale
    })

    expect(await tagTask({ actorId: ada, taskId, tagId: urgent })).toEqual({
      ok: false,
      error: new ConflictError('Task', taskId),
    })
    expect(await taskTags()).toEqual({ 'Write the brief': ['Design'] })
  })
})

describe('deleteTag', () => {
  it('removes the tag from the board at once', async () => {
    const urgent = await givenTag('Urgent', 'red')
    await givenTag('Later', 'gray')

    expect(await deleteTag({ actorId: ben, boardId, tagId: urgent })).toEqual({
      ok: true,
      value: undefined,
    })

    expect(await tags()).toEqual(['Later:gray'])
  })

  it('strips the tag from every task once the relay drains, each TaskUntagged caused by TagDeleted', async () => {
    const urgent = await givenTag('Urgent')
    const later = await givenTag('Later')
    const first = await givenTask('Write the brief')
    const second = await givenTask('Book the venue')
    await givenTask('Pick the date')
    for (const [taskId, tagId] of [
      [first, urgent],
      [first, later],
      [second, urgent],
    ] as const) {
      await tagTask({ actorId: ada, taskId, tagId })
    }
    const relay = await getInjection('IEventRelay')
    await relay.drain()

    await deleteTag({ actorId: ben, boardId, tagId: urgent })
    const tagDeleted = (await new MockOutbox('boards').pending(100)).find(
      (row) => row.envelope.type === 'boards.TagDeleted'
    )
    const saves = vi.spyOn(await getInjection('ITaskRepository'), 'save')
    await relay.drain()

    expect(await taskTags()).toEqual({
      'Write the brief': ['Later'],
      'Book the venue': [],
      'Pick the date': [],
    })
    expect(
      saves.mock.calls.map(([task, events, origin]) => ({
        taskId: task.id,
        events: events.map((event) => event.type),
        origin,
      }))
    ).toEqual(
      [first, second].sort().map((taskId) => ({
        taskId,
        events: ['TaskUntagged'],
        origin: { actorId: ben, causationId: tagDeleted?.envelope.id },
      }))
    )
    expect(tagDeleted).toBeDefined()
  })

  it('changes nothing when TagDeleted is delivered again', async () => {
    const urgent = await givenTag('Urgent')
    const taskId = await givenTask('Write the brief')
    await tagTask({ actorId: ada, taskId, tagId: urgent })
    await deleteTag({ actorId: ada, boardId, tagId: urgent })
    const tagDeleted = (await new MockOutbox('boards').pending(100)).find(
      (row) => row.envelope.type === 'boards.TagDeleted'
    )
    if (!tagDeleted) throw new Error('setup failed')
    await (await getInjection('IEventRelay')).drain()
    const saves = vi.spyOn(await getInjection('ITaskRepository'), 'save')

    await untagDeletedTag(
      tagDeleted.envelope as Parameters<typeof untagDeletedTag>[0]
    )

    expect(saves).not.toHaveBeenCalled()
    expect(await taskTags()).toEqual({ 'Write the brief': [] })
  })

  it('returns NotFoundError for a tag that doesn’t exist', async () => {
    expect(await deleteTag({ actorId: ada, boardId, tagId: 'gone' })).toEqual({
      ok: false,
      error: new NotFoundError('Tag', 'gone'),
    })
  })

  it('returns ForbiddenError for a user who isn’t a Board member', async () => {
    const urgent = await givenTag('Urgent')
    const cy = await givenUser('Cy')

    expect(await deleteTag({ actorId: cy, boardId, tagId: urgent })).toEqual({
      ok: false,
      error: new ForbiddenError(),
    })
    expect(await tags()).toEqual(['Urgent:blue'])
  })
})

describe('listTags', () => {
  it('returns NotFoundError for a board that doesn’t exist', async () => {
    expect(await listTags({ actorId: ada, boardId: 'nowhere' })).toEqual({
      ok: false,
      error: new NotFoundError('Board', 'nowhere'),
    })
  })
})
