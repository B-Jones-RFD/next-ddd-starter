import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { getInjection } from '@/di/container'
import { AUDIT_HANDLERS } from '@/modules/audit/application/handlers/audit-handlers'
import { getActivity } from '@/modules/audit/api'
import {
  addComment,
  addMember,
  createBoard,
  createList,
  createTask,
  ForbiddenError,
  NotFoundError,
  renameTask,
  TaskArchivedError,
  ValidationError,
} from '@/modules/boards/api'
import { resetMockStores } from '@/shared/infrastructure/mock-stores'
import { uuidv7 } from '@/shared/infrastructure/uuid-v7'
import { PersistenceError } from '@/shared/kernel/errors/infrastructure-error'
import type { UserId } from '@/shared/kernel/user-id'

import { anEnvelope } from '@tests/fixtures/envelopes'
import { givenUser } from '@tests/fixtures/users'

let ada: UserId
let ben: UserId
let boardId: string
let taskId: string

async function drain() {
  await (await getInjection('IEventRelay')).drain()
}

/** The task's Activity as Ada reads it, after a relay drain. */
async function activity() {
  await drain()
  const page = await getActivity({ actorId: ada, taskId })
  if (!page.ok) throw new Error('read failed')
  return page.value
}

/** Makes the task read as archived from now on, as if just archived. */
async function archivedFromNow(id: string) {
  const tasks = await getInjection('ITaskRepository')
  const findById = tasks.findById.bind(tasks)
  vi.spyOn(tasks, 'findById').mockImplementation(async (taskId) => {
    const found = await findById(taskId)
    return found.ok && taskId === id
      ? { ok: true, value: { ...found.value, archived: true } }
      : found
  })
}

beforeEach(async () => {
  resetMockStores()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-03-01T09:00:00.000Z'))
  ada = await givenUser('Ada', 'ada@example.com')
  ben = await givenUser('Ben', 'ben@example.com')
  const board = await createBoard({ actorId: ada, name: 'Launch plan' })
  if (!board.ok) throw new Error('setup failed')
  boardId = board.value.boardId
  await addMember({ actorId: ada, boardId, userId: ben })
  const list = await createList({ actorId: ada, boardId, name: 'Backlog' })
  if (!list.ok) throw new Error('setup failed')
  const task = await createTask({
    actorId: ada,
    listId: list.value.listId,
    title: 'Write the brief',
  })
  if (!task.ok) throw new Error('setup failed')
  taskId = task.value.taskId
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('addComment', () => {
  it('shows a Member’s comment in the task’s Activity with its author, time and text', async () => {
    vi.setSystemTime(new Date('2026-03-01T10:00:00.000Z'))

    const result = await addComment({
      actorId: ben,
      taskId,
      text: ' Can we keep it to one page? ',
    })

    expect(result).toEqual({
      ok: true,
      value: { commentId: expect.any(String) },
    })
    const page = await activity()
    expect(page.entries[0]).toMatchObject({
      occurredAt: '2026-03-01T10:00:00.000Z',
      actorId: ben,
      action: 'comment.added',
      details: {
        commentId: result.ok ? result.value.commentId : '',
        text: 'Can we keep it to one page?',
      },
    })
    expect(page.names[ben]).toBe('Ben')
  })

  it('places comments in time order with the task’s other entries', async () => {
    vi.setSystemTime(new Date('2026-03-01T10:00:00.000Z'))
    await addComment({ actorId: ben, taskId, text: 'First thoughts' })
    vi.setSystemTime(new Date('2026-03-01T10:05:00.000Z'))
    await renameTask({ actorId: ada, taskId, title: 'Write the press brief' })
    vi.setSystemTime(new Date('2026-03-01T10:10:00.000Z'))
    await addComment({ actorId: ada, taskId, text: 'Renamed it' })

    expect((await activity()).entries.map((entry) => entry.action)).toEqual([
      'comment.added',
      'task.renamed',
      'comment.added',
      'task.created',
    ])
  })

  it('lets the Owner comment', async () => {
    expect((await addComment({ actorId: ada, taskId, text: 'Hi' })).ok).toBe(
      true
    )
  })

  // #region non-member
  it('rejects someone who isn’t a Board member, adding nothing', async () => {
    const cy = await givenUser('Cy', 'cy@example.com')

    expect(await addComment({ actorId: cy, taskId, text: 'Hello' })).toEqual({
      ok: false,
      error: new ForbiddenError(),
    })
    expect((await activity()).entries).toHaveLength(1)
  })
  // #endregion non-member

  it('rejects a comment on an archived task', async () => {
    await archivedFromNow(taskId)

    expect(await addComment({ actorId: ben, taskId, text: 'Hello' })).toEqual({
      ok: false,
      error: new TaskArchivedError(),
    })
  })

  it('returns NotFoundError for a task that doesn’t exist', async () => {
    const result = await addComment({
      actorId: ben,
      taskId: 'nowhere',
      text: 'Hello',
    })

    expect(result.ok ? undefined : result.error).toBeInstanceOf(NotFoundError)
  })

  it.each([
    ['empty', '', 'required'],
    ['over 2000 characters', 'a'.repeat(2001), 'too-long'],
  ] as const)(
    'rejects text that is %s under its field',
    async (_, text, issue) => {
      const result = await addComment({ actorId: ben, taskId, text })

      expect(result).toEqual({
        ok: false,
        error: new ValidationError({ text: issue }),
      })
    }
  )

  it('rejects a missing task id as a field error', async () => {
    const result = await addComment({ actorId: ben, taskId: '', text: 'Hi' })

    expect(result.ok ? undefined : result.error).toBeInstanceOf(ValidationError)
  })

  it('lets an outage propagate', async () => {
    const comments = await getInjection('ICommentRepository')
    const outage = new PersistenceError('ICommentRepository', {
      retryable: true,
    })
    vi.spyOn(comments, 'save').mockRejectedValueOnce(outage)

    await expect(
      addComment({ actorId: ben, taskId, text: 'Hello' })
    ).rejects.toBe(outage)
  })

  it('makes no second entry for a redelivered CommentAdded', async () => {
    const handler = AUDIT_HANDLERS.find(
      (h) => h.name === 'audit.recordCommentAdded'
    )
    const envelope = anEnvelope({
      id: uuidv7(),
      type: 'boards.CommentAdded',
      aggregateId: 'comment-1',
      aggregateVersion: 1,
      actorId: ben,
      payload: { commentId: 'comment-1', taskId, boardId, text: 'Once' },
    })

    await handler?.handle(envelope)
    await handler?.handle(envelope)

    const comments = (await activity()).entries.filter(
      (entry) => entry.action === 'comment.added'
    )
    expect(comments).toHaveLength(1)
  })
})
