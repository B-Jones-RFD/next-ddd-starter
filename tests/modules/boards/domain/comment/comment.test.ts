import { describe, expect, it } from 'vitest'

import { addComment } from '@/modules/boards/domain/comment/comment'
import { toCommentId } from '@/modules/boards/domain/comment/comment-id'
import { TaskArchivedError } from '@/modules/boards/domain/task/task.errors'
import {
  ForbiddenError,
  type ValidationError,
} from '@/shared/kernel/errors/domain-error'
import { toUserId } from '@/shared/kernel/user-id'

import { aTask } from '@tests/fixtures/tasks'

const now = new Date('2026-03-01T10:00:00.000Z')
const ben = toUserId('user-ben')

const issues = (result: { ok: boolean; error?: unknown }) =>
  result.ok ? undefined : (result.error as ValidationError).fields

describe('addComment', () => {
  const task = aTask()
  const add = (overrides: Partial<Parameters<typeof addComment>[0]> = {}) =>
    addComment({
      id: toCommentId('comment-new'),
      task,
      membership: 'member',
      authorId: ben,
      text: '  Shall we move the date?\nI can’t make the 3rd.  ',
      now,
      ...overrides,
    })

  it('adds a trimmed comment by its author at version 0 and raises CommentAdded with its text', () => {
    expect(add()).toEqual({
      ok: true,
      value: {
        state: {
          id: 'comment-new',
          taskId: task.id,
          boardId: task.boardId,
          authorId: ben,
          text: 'Shall we move the date?\nI can’t make the 3rd.',
          createdAt: now,
          version: 0,
        },
        events: [
          {
            type: 'CommentAdded',
            payload: {
              commentId: 'comment-new',
              taskId: task.id,
              boardId: task.boardId,
              text: 'Shall we move the date?\nI can’t make the 3rd.',
            },
          },
        ],
      },
    })
  })

  it('lets the Owner comment', () => {
    expect(add({ membership: 'owner' }).ok).toBe(true)
  })

  it('rejects someone who isn’t a Board member', () => {
    expect(add({ membership: undefined })).toEqual({
      ok: false,
      error: new ForbiddenError(),
    })
  })

  it('rejects a comment on an archived task', () => {
    expect(add({ task: aTask({ archived: true }) })).toEqual({
      ok: false,
      error: new TaskArchivedError(),
    })
  })

  it.each([
    ['empty', '', 'required'],
    ['only spaces', ' \n ', 'required'],
    ['over 2000 characters', 'a'.repeat(2001), 'too-long'],
  ])('rejects text that is %s', (_, text, issue) => {
    expect(issues(add({ text }))).toEqual({ text: issue })
  })

  it('accepts 2000 characters', () => {
    expect(add({ text: 'a'.repeat(2000) }).ok).toBe(true)
  })
})
