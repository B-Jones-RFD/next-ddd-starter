import { describe, expect, it } from 'vitest'

import { toBoardId } from '@/modules/boards/domain/board/board-id'
import { toTagId, type Tag } from '@/modules/boards/domain/board/tag'
import type { TagName } from '@/modules/boards/domain/board/tag-name'
import {
  tagTask,
  untagTask,
} from '@/modules/boards/domain/services/task-tagging.service'
import { TaskArchivedError } from '@/modules/boards/domain/task/task.errors'
import { NotFoundError } from '@/shared/kernel/errors/app-error'
import { ForbiddenError } from '@/shared/kernel/errors/domain-error'
import { toUserId } from '@/shared/kernel/user-id'

import { aBoard } from '@tests/fixtures/boards'
import { aTask } from '@tests/fixtures/tasks'

const member = toUserId('user-member')
const outsider = toUserId('user-outsider')
const urgent: Tag = {
  id: toTagId('tag-urgent'),
  name: 'Urgent' as TagName,
  color: 'red',
}
const design: Tag = {
  id: toTagId('tag-design'),
  name: 'Design' as TagName,
  color: 'teal',
}
const board = aBoard({
  id: toBoardId('board-lists'),
  members: [
    { userId: toUserId('user-owner'), role: 'owner' },
    { userId: member, role: 'member' },
  ],
  tags: [urgent, design],
})
const otherBoard = aBoard({
  members: [{ userId: member, role: 'owner' }],
  tags: [{ ...urgent, id: toTagId('tag-elsewhere') }],
})

describe('tagTask', () => {
  const task = aTask({ boardId: board.id, tagIds: [design.id] })

  it('attaches a tag of the task’s board and raises TaskTagged', () => {
    expect(tagTask(task, board, member, urgent.id)).toEqual({
      ok: true,
      value: {
        state: { ...task, tagIds: [design.id, urgent.id] },
        events: [
          {
            type: 'TaskTagged',
            payload: { taskId: task.id, boardId: board.id, tagId: urgent.id },
          },
        ],
      },
    })
  })

  it('raises nothing for a tag the task already has', () => {
    expect(tagTask(task, board, member, design.id)).toEqual({
      ok: true,
      value: { state: task, events: [] },
    })
  })

  it('returns NotFoundError for a tag from another board', () => {
    expect(tagTask(task, board, member, toTagId('tag-elsewhere'))).toEqual({
      ok: false,
      error: new NotFoundError('Tag', 'tag-elsewhere'),
    })
  })

  it('returns NotFoundError when the board given isn’t the task’s', () => {
    expect(tagTask(task, otherBoard, member, toTagId('tag-elsewhere'))).toEqual(
      { ok: false, error: new NotFoundError('Tag', 'tag-elsewhere') }
    )
  })

  it('returns ForbiddenError for a user who isn’t a Board member', () => {
    expect(tagTask(task, board, outsider, urgent.id)).toEqual({
      ok: false,
      error: new ForbiddenError(),
    })
  })
})

describe('untagTask', () => {
  const task = aTask({ boardId: board.id, tagIds: [urgent.id, design.id] })

  it('detaches the tag and raises TaskUntagged', () => {
    expect(untagTask(task, board, member, urgent.id)).toEqual({
      ok: true,
      value: {
        state: { ...task, tagIds: [design.id] },
        events: [
          {
            type: 'TaskUntagged',
            payload: { taskId: task.id, boardId: board.id, tagId: urgent.id },
          },
        ],
      },
    })
  })

  it('raises nothing for a tag the task doesn’t have', () => {
    const untagged = aTask({ boardId: board.id, tagIds: [] })

    expect(untagTask(untagged, board, member, urgent.id)).toEqual({
      ok: true,
      value: { state: untagged, events: [] },
    })
  })

  it('returns NotFoundError for a tag that isn’t on the task’s board', () => {
    expect(untagTask(task, board, member, toTagId('tag-gone'))).toEqual({
      ok: false,
      error: new NotFoundError('Tag', 'tag-gone'),
    })
  })

  it('returns ForbiddenError for a user who isn’t a Board member', () => {
    expect(untagTask(task, board, outsider, urgent.id)).toEqual({
      ok: false,
      error: new ForbiddenError(),
    })
  })
})

describe('an archived task', () => {
  const archived = aTask({ archived: true, tagIds: [urgent.id] })

  it.each([
    ['tagTask', () => tagTask(archived, board, member, design.id)],
    ['untagTask', () => untagTask(archived, board, member, urgent.id)],
  ])('refuses %s', (_name, change) => {
    expect(change()).toEqual({ ok: false, error: new TaskArchivedError() })
  })
})
