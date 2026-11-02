import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { getInjection } from '@/di/container'
import {
  ForbiddenError,
  getActivity,
  getBoardLog,
  getUserLog,
  ValidationError,
} from '@/modules/audit/api'
import {
  addMember,
  createBoard,
  createList,
  createTask,
  moveList,
  renameBoard,
  renameTask,
  reorderTask,
  transferOwnership,
} from '@/modules/boards/api'
import { changePassword, rename, signIn, signOut } from '@/modules/identity/api'
import { resetMockStores } from '@/shared/infrastructure/mock-stores'
import type { UserId } from '@/shared/kernel/user-id'

import { givenUser } from '@tests/fixtures/users'

let ada: UserId
let boardId: string
let backlog: string
let taskId: string

async function drain() {
  await (await getInjection('IEventRelay')).drain()
}

async function boardLog(
  input: { actorId?: UserId; before?: string; includeReorders?: boolean } = {}
) {
  await drain()
  const page = await getBoardLog({ actorId: ada, boardId, ...input })
  if (!page.ok) throw new Error('read failed')
  return page.value
}

async function userLog(actorId: UserId, before?: string) {
  await drain()
  const page = await getUserLog({ actorId, ...(before ? { before } : {}) })
  if (!page.ok) throw new Error('read failed')
  return page.value
}

beforeEach(async () => {
  resetMockStores()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-03-01T09:00:00.000Z'))
  ada = await givenUser('Ada', 'ada@example.com')
  const created = await createBoard({ actorId: ada, name: 'Launch plan' })
  if (!created.ok) throw new Error('setup failed')
  boardId = created.value.boardId
  const list = await createList({ actorId: ada, boardId, name: 'Backlog' })
  if (!list.ok) throw new Error('setup failed')
  backlog = list.value.listId
  const task = await createTask({
    actorId: ada,
    listId: backlog,
    title: 'Write the brief',
  })
  if (!task.ok) throw new Error('setup failed')
  taskId = task.value.taskId
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('getBoardLog', () => {
  it('shows the Owner every board, list, task and member change, newest first, naming what each is about', async () => {
    const ben = await givenUser('Ben', 'ben@example.com')
    await addMember({ actorId: ada, boardId, userId: ben })
    await renameBoard({ actorId: ada, boardId, name: 'Launch' })
    await renameTask({ actorId: ada, taskId, title: 'Write the press brief' })

    const page = await boardLog()

    expect(
      page.entries.map(({ action, subject, subjectId, details }) => ({
        action,
        subject,
        subjectId,
        details,
      }))
    ).toEqual([
      {
        action: 'task.renamed',
        subject: 'task',
        subjectId: taskId,
        details: { from: 'Write the brief', to: 'Write the press brief' },
      },
      {
        action: 'board.renamed',
        subject: 'board',
        subjectId: boardId,
        details: { from: 'Launch plan', to: 'Launch' },
      },
      {
        action: 'member.added',
        subject: 'board',
        subjectId: boardId,
        details: { userId: ben },
      },
      {
        action: 'task.created',
        subject: 'task',
        subjectId: taskId,
        details: { listId: backlog, title: 'Write the brief' },
      },
      {
        action: 'list.created',
        subject: 'list',
        subjectId: backlog,
        details: { name: 'Backlog' },
      },
      {
        action: 'board.created',
        subject: 'board',
        subjectId: boardId,
        details: { name: 'Launch plan' },
      },
    ])
    expect(page.names).toEqual({
      [ada]: 'Ada',
      [ben]: 'Ben',
      [backlog]: 'Backlog',
      [taskId]: 'Write the press brief',
    })
    expect(page.olderBefore).toBeNull()
  })

  it('hides reorders unless asked for them', async () => {
    const second = await createList({ actorId: ada, boardId, name: 'Done' })
    if (!second.ok) throw new Error('setup failed')
    const other = await createTask({
      actorId: ada,
      listId: backlog,
      title: 'Book the venue',
    })
    if (!other.ok) throw new Error('setup failed')
    await moveList({
      actorId: ada,
      listId: second.value.listId,
      before: backlog,
    })
    await reorderTask({ actorId: ada, taskId, after: other.value.taskId })

    const hidden = await boardLog()
    const shown = await boardLog({ includeReorders: true })

    expect(hidden.entries.map((entry) => entry.action)).not.toContain(
      'list.reordered'
    )
    expect(hidden.entries.map((entry) => entry.action)).not.toContain(
      'task.reordered'
    )
    expect(shown.entries.map((entry) => entry.action).slice(0, 2)).toEqual([
      'task.reordered',
      'list.reordered',
    ])
  })

  it('pages through a long log 50 at a time', async () => {
    for (let n = 1; n <= 52; n += 1) {
      await renameTask({ actorId: ada, taskId, title: `Title ${n}` })
    }

    const first = await boardLog()
    const second = await boardLog({ before: first.olderBefore ?? 'missing' })

    expect(first.entries).toHaveLength(50)
    expect(first.olderBefore).toBe(first.entries[49]?.id)
    expect(second.entries.map((entry) => entry.action)).toEqual([
      'task.renamed',
      'task.renamed',
      'task.created',
      'list.created',
      'board.created',
    ])
    expect(second.olderBefore).toBeNull()
  })

  it('returns ForbiddenError to a Member', async () => {
    const ben = await givenUser('Ben', 'ben@example.com')
    await addMember({ actorId: ada, boardId, userId: ben })
    await drain()

    expect(await getBoardLog({ actorId: ben, boardId })).toEqual({
      ok: false,
      error: new ForbiddenError(),
    })
  })

  it('returns ForbiddenError to someone who isn’t a Board member', async () => {
    const cy = await givenUser('Cy', 'cy@example.com')

    expect(await getBoardLog({ actorId: cy, boardId })).toEqual({
      ok: false,
      error: new ForbiddenError(),
    })
  })

  it('moves with ownership: the former Owner loses it at once, the new Owner gains it', async () => {
    const ben = await givenUser('Ben', 'ben@example.com')
    await addMember({ actorId: ada, boardId, userId: ben })
    await transferOwnership({ actorId: ada, boardId, userId: ben })
    await drain()

    expect(await getBoardLog({ actorId: ada, boardId })).toEqual({
      ok: false,
      error: new ForbiddenError(),
    })
    expect((await getBoardLog({ actorId: ben, boardId })).ok).toBe(true)
  })

  it('returns ValidationError for a missing board id', async () => {
    expect(await getBoardLog({ actorId: ada, boardId: '' })).toEqual({
      ok: false,
      error: new ValidationError({ boardId: 'invalid' }),
    })
  })
})

describe('getUserLog', () => {
  it('shows a user their own sign-ins, sign-outs and account changes, newest first', async () => {
    vi.setSystemTime(new Date('2026-03-01T10:00:00.000Z'))
    const session = await signIn({
      email: 'ada@example.com',
      password: 'correct horse',
    })
    if (!session.ok) throw new Error('setup failed')
    const { token } = session.value
    vi.setSystemTime(new Date('2026-03-01T10:05:00.000Z'))
    await rename({ actorId: ada, displayName: 'Ada L.' })
    vi.setSystemTime(new Date('2026-03-01T10:10:00.000Z'))
    await changePassword({
      actorId: ada,
      token,
      currentPassword: 'correct horse',
      newPassword: 'battery staple',
    })
    vi.setSystemTime(new Date('2026-03-01T10:15:00.000Z'))
    await signOut(token)

    const page = await userLog(ada)

    expect(
      page.entries.map(({ action, occurredAt, details }) => ({
        action,
        occurredAt,
        details,
      }))
    ).toEqual([
      {
        action: 'user.signed-out',
        occurredAt: '2026-03-01T10:15:00.000Z',
        details: { everywhere: false },
      },
      {
        action: 'user.password-changed',
        occurredAt: '2026-03-01T10:10:00.000Z',
        details: {},
      },
      {
        action: 'user.renamed',
        occurredAt: '2026-03-01T10:05:00.000Z',
        details: { from: 'Ada', to: 'Ada L.' },
      },
      {
        action: 'user.signed-in',
        occurredAt: '2026-03-01T10:00:00.000Z',
        details: {},
      },
      {
        action: 'user.signed-in',
        occurredAt: '2026-03-01T09:00:00.000Z',
        details: {},
      },
      {
        action: 'user.registered',
        occurredAt: '2026-03-01T09:00:00.000Z',
        details: { displayName: 'Ada' },
      },
    ])
    expect(page.names).toEqual({ [ada]: 'Ada L.' })
  })

  it('shows no one else’s entries', async () => {
    const ben = await givenUser('Ben', 'ben@example.com')
    await rename({ actorId: ben, displayName: 'Benjamin' })

    const page = await userLog(ada)

    // Signing up signs Ada in.
    expect(page.entries.map((entry) => entry.action)).toEqual([
      'user.signed-in',
      'user.registered',
    ])
  })

  it('pages through a long log 50 at a time', async () => {
    for (let n = 1; n <= 49; n += 1) {
      await rename({ actorId: ada, displayName: `Ada ${n}` })
    }

    const first = await userLog(ada)
    const second = await userLog(ada, first.olderBefore ?? 'missing')

    expect(first.entries).toHaveLength(50)
    expect(first.entries[49]?.action).toBe('user.signed-in')
    expect(second.entries.map((entry) => entry.action)).toEqual([
      'user.registered',
    ])
    expect(second.olderBefore).toBeNull()
  })
})

describe('getActivity with reorders', () => {
  it('shows a task’s reorders when asked for them', async () => {
    const other = await createTask({
      actorId: ada,
      listId: backlog,
      title: 'Book the venue',
    })
    if (!other.ok) throw new Error('setup failed')
    await reorderTask({ actorId: ada, taskId, after: other.value.taskId })
    await drain()

    const page = await getActivity({
      actorId: ada,
      taskId,
      includeReorders: true,
    })

    if (!page.ok) throw new Error('read failed')
    expect(page.value.entries.map((entry) => entry.action)).toEqual([
      'task.reordered',
      'task.created',
    ])
  })
})
