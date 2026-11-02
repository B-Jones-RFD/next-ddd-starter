import { describe, expect, it } from 'vitest'

import { toBoardId } from '@/modules/boards/domain/board/board-id'
import {
  ListArchivedError,
  ListHasActiveTasksError,
} from '@/modules/boards/domain/list/list.errors'
import { toListId } from '@/modules/boards/domain/list/list-id'
import {
  archiveList,
  restoreTask,
} from '@/modules/boards/domain/services/archiving.service'
import { NotFoundError } from '@/shared/kernel/errors/app-error'
import { ForbiddenError } from '@/shared/kernel/errors/domain-error'

import { asMember, asOutsider } from '@tests/fixtures/boards'
import { aList } from '@tests/fixtures/lists'
import { aTask } from '@tests/fixtures/tasks'

const boardId = toBoardId('board-lists')

describe('archiveList', () => {
  const list = aList({ id: toListId('list-done'), boardId, position: 'k' })

  it('archives a list with no active tasks in its place and raises ListArchived', () => {
    const archivedTask = aTask({ listId: list.id, archived: true })

    expect(archiveList(list, asMember(), [archivedTask])).toEqual({
      ok: true,
      value: {
        state: { ...list, archived: true },
        events: [
          {
            type: 'ListArchived',
            payload: { listId: list.id, boardId },
          },
        ],
      },
    })
  })

  it('archives an empty list', () => {
    expect(archiveList(list, asMember('owner'), []).ok).toBe(true)
  })

  it('returns ListHasActiveTasksError while any task in it is active', () => {
    const tasks = [
      aTask({ listId: list.id, archived: true }),
      aTask({ listId: list.id }),
    ]

    expect(archiveList(list, asMember(), tasks)).toEqual({
      ok: false,
      error: new ListHasActiveTasksError(),
    })
  })

  it('ignores active tasks in other lists', () => {
    const elsewhere = aTask({ listId: toListId('list-other') })

    expect(archiveList(list, asMember(), [elsewhere]).ok).toBe(true)
  })

  it('raises nothing for a list already archived', () => {
    const archived = { ...list, archived: true }

    expect(archiveList(archived, asMember(), [])).toEqual({
      ok: true,
      value: { state: archived, events: [] },
    })
  })

  it('returns ForbiddenError for a user who isn’t a Board member', () => {
    expect(archiveList(list, asOutsider, [])).toEqual({
      ok: false,
      error: new ForbiddenError(),
    })
  })
})

describe('restoreTask', () => {
  const list = aList({ id: toListId('list-tasks'), boardId })
  const task = aTask({ listId: list.id, archived: true, position: 'k' })

  it('restores the task in its old place and raises TaskRestored', () => {
    expect(restoreTask(task, asMember(), list)).toEqual({
      ok: true,
      value: {
        state: { ...task, archived: false },
        events: [
          {
            type: 'TaskRestored',
            payload: { taskId: task.id, boardId, listId: list.id },
          },
        ],
      },
    })
  })

  it('returns ListArchivedError when its list is archived', () => {
    expect(restoreTask(task, asMember(), { ...list, archived: true })).toEqual({
      ok: false,
      error: new ListArchivedError(),
    })
  })

  it('returns NotFoundError for a list that isn’t the task’s', () => {
    const other = aList({ id: toListId('list-other'), boardId })

    expect(restoreTask(task, asMember(), other)).toEqual({
      ok: false,
      error: new NotFoundError('List', other.id),
    })
  })

  it('raises nothing for an active task', () => {
    const active = { ...task, archived: false }

    expect(restoreTask(active, asMember(), list)).toEqual({
      ok: true,
      value: { state: active, events: [] },
    })
  })

  it('returns ForbiddenError for a user who isn’t a Board member', () => {
    expect(restoreTask(task, asOutsider, list)).toEqual({
      ok: false,
      error: new ForbiddenError(),
    })
  })
})
