import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { getInjection } from '@/di/container'
import { AUDIT_HANDLERS } from '@/modules/audit/application/handlers/audit-handlers'
import {
  ForbiddenError,
  getActivity,
  ValidationError,
} from '@/modules/audit/api'
import {
  addMember,
  changeTaskDescription,
  createBoard,
  createList,
  createTask,
  moveTask,
  removeMember,
  renameList,
  renameTask,
  reorderTask,
} from '@/modules/boards/api'
import { rename } from '@/modules/identity/api'
import { resetMockStores } from '@/shared/infrastructure/mock-stores'
import { uuidv7 } from '@/shared/infrastructure/uuid-v7'
import { PersistenceError } from '@/shared/kernel/errors/infrastructure-error'
import type { UserId } from '@/shared/kernel/user-id'

import { anEnvelope } from '@tests/fixtures/envelopes'
import { givenUser } from '@tests/fixtures/users'

let ada: UserId
let boardId: string
let backlog: string
let done: string
let taskId: string

async function drain() {
  await (await getInjection('IEventRelay')).drain()
}

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

/** The task's Activity as `actorId` reads it, after a relay drain. */
async function activity(actorId = ada, before?: string) {
  await drain()
  const page = await getActivity({
    actorId,
    taskId,
    ...(before ? { before } : {}),
  })
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
  backlog = await givenList('Backlog')
  done = await givenList('Done')
  vi.setSystemTime(new Date('2026-03-01T10:00:00.000Z'))
  taskId = await givenTask(backlog, 'Write the brief')
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('getActivity', () => {
  it('shows who did what to the task and when, newest first, with before and after values', async () => {
    vi.setSystemTime(new Date('2026-03-01T10:05:00.000Z'))
    await renameTask({ actorId: ada, taskId, title: 'Write the press brief' })
    vi.setSystemTime(new Date('2026-03-01T10:10:00.000Z'))
    await changeTaskDescription({ actorId: ada, taskId, description: 'Draft' })
    vi.setSystemTime(new Date('2026-03-01T10:15:00.000Z'))
    await moveTask({ actorId: ada, taskId, toListId: done })

    const page = await activity()

    expect(page.entries).toEqual([
      {
        id: expect.any(String),
        occurredAt: '2026-03-01T10:15:00.000Z',
        actorId: ada,
        action: 'task.moved',
        details: { fromListId: backlog, toListId: done },
        causationId: null,
        cause: null,
      },
      {
        id: expect.any(String),
        occurredAt: '2026-03-01T10:10:00.000Z',
        actorId: ada,
        action: 'task.description-changed',
        details: { from: '', to: 'Draft' },
        causationId: null,
        cause: null,
      },
      {
        id: expect.any(String),
        occurredAt: '2026-03-01T10:05:00.000Z',
        actorId: ada,
        action: 'task.renamed',
        details: { from: 'Write the brief', to: 'Write the press brief' },
        causationId: null,
        cause: null,
      },
      {
        id: expect.any(String),
        occurredAt: '2026-03-01T10:00:00.000Z',
        actorId: ada,
        action: 'task.created',
        details: { listId: backlog, title: 'Write the brief' },
        causationId: null,
        cause: null,
      },
    ])
    expect(page.olderBefore).toBeNull()
  })

  it('names people and lists by their current names', async () => {
    await moveTask({ actorId: ada, taskId, toListId: done })
    await drain()
    await renameList({ actorId: ada, listId: done, name: 'Shipped' })
    await rename({ actorId: ada, displayName: 'Ada L.' })

    const { names } = await activity()

    expect(names).toEqual({
      [ada]: 'Ada L.',
      [backlog]: 'Backlog',
      [done]: 'Shipped',
    })
  })

  it('hides reorders', async () => {
    const second = await givenTask(backlog, 'Book the venue')
    await reorderTask({ actorId: ada, taskId, after: second })

    const page = await activity()

    expect(page.entries.map((entry) => entry.action)).toEqual(['task.created'])
  })

  it('pages through long histories 50 at a time', async () => {
    for (let n = 1; n <= 54; n += 1) {
      await renameTask({ actorId: ada, taskId, title: `Title ${n}` })
    }

    const first = await activity()
    const second = await activity(ada, first.olderBefore ?? 'missing')

    expect(first.entries).toHaveLength(50)
    expect(first.entries[0]?.details).toEqual({
      from: 'Title 53',
      to: 'Title 54',
    })
    expect(first.olderBefore).toBe(first.entries[49]?.id)
    expect(second.entries.map((entry) => entry.details)).toEqual([
      { from: 'Title 3', to: 'Title 4' },
      { from: 'Title 2', to: 'Title 3' },
      { from: 'Title 1', to: 'Title 2' },
      { from: 'Write the brief', to: 'Title 1' },
      { listId: backlog, title: 'Write the brief' },
    ])
    expect(second.olderBefore).toBeNull()
  })

  it('makes no second entry for a redelivered event', async () => {
    const handler = AUDIT_HANDLERS.find(
      (h) => h.name === 'audit.recordTaskRenamed'
    )
    const envelope = anEnvelope({
      id: uuidv7(),
      type: 'boards.TaskRenamed',
      aggregateId: taskId,
      aggregateVersion: 2,
      actorId: ada,
      payload: { taskId, boardId, from: 'Write the brief', to: 'Brief' },
    })

    await handler?.handle(envelope)
    await handler?.handle(envelope)

    const page = await activity()
    expect(page.entries.map((entry) => entry.id)).toEqual([
      envelope.id,
      expect.any(String),
    ])
  })

  it('shows a Consequence with the entry that caused it', async () => {
    const [created] = (await activity()).entries
    const handler = AUDIT_HANDLERS.find(
      (h) => h.name === 'audit.recordTaskRenamed'
    )
    await handler?.handle(
      anEnvelope({
        id: uuidv7(),
        type: 'boards.TaskRenamed',
        aggregateId: taskId,
        aggregateVersion: 2,
        actorId: ada,
        causationId: created?.id ?? null,
        payload: { taskId, boardId, from: 'Write the brief', to: 'Brief' },
      })
    )

    const [consequence] = (await activity()).entries

    expect(consequence?.causationId).toBe(created?.id)
    expect(consequence?.cause).toEqual({
      id: created?.id,
      occurredAt: '2026-03-01T10:00:00.000Z',
      actorId: ada,
      action: 'task.created',
      details: { listId: backlog, title: 'Write the brief' },
      causationId: null,
    })
  })

  it('lets a Member read it, until they are removed', async () => {
    const ben = await givenUser('Ben', 'ben@example.com')
    await addMember({ actorId: ada, boardId, userId: ben })
    await drain()

    expect((await getActivity({ actorId: ben, taskId })).ok).toBe(true)

    await removeMember({ actorId: ada, boardId, userId: ben })

    expect(await getActivity({ actorId: ben, taskId })).toEqual({
      ok: false,
      error: new ForbiddenError(),
    })
  })

  it('returns ForbiddenError to someone who isn’t a Board member', async () => {
    const cy = await givenUser('Cy', 'cy@example.com')
    await drain()

    expect(await getActivity({ actorId: cy, taskId })).toEqual({
      ok: false,
      error: new ForbiddenError(),
    })
  })

  it('returns an empty page for a task audit has heard nothing of', async () => {
    expect(await getActivity({ actorId: ada, taskId: 'no-such-task' })).toEqual(
      {
        ok: true,
        value: { entries: [], names: {}, olderBefore: null },
      }
    )
  })

  it('returns ValidationError for a missing task id', async () => {
    expect(await getActivity({ actorId: ada, taskId: '' })).toEqual({
      ok: false,
      error: new ValidationError({ taskId: 'invalid' }),
    })
  })

  it('lets an outage in boards propagate as audit’s own PersistenceError', async () => {
    await drain()
    const outage = new PersistenceError('IBoardReader', { retryable: true })
    vi.spyOn(
      await getInjection('IBoardReader'),
      'roleOf'
    ).mockRejectedValueOnce(outage)

    await expect(getActivity({ actorId: ada, taskId })).rejects.toMatchObject({
      port: 'IBoardAccess',
      retryable: true,
      cause: outage,
    })
  })
})
