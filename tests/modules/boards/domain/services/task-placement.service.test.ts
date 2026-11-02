import { describe, expect, it } from 'vitest'

import { toBoardId } from '@/modules/boards/domain/board/board-id'
import { ListArchivedError } from '@/modules/boards/domain/list/list.errors'
import { toListId } from '@/modules/boards/domain/list/list-id'
import { moveTask } from '@/modules/boards/domain/services/task-placement.service'
import { TaskArchivedError } from '@/modules/boards/domain/task/task.errors'
import { ConflictError, NotFoundError } from '@/shared/kernel/errors/app-error'
import { ForbiddenError } from '@/shared/kernel/errors/domain-error'

import { aList } from '@tests/fixtures/lists'
import { aTask } from '@tests/fixtures/tasks'

const boardId = toBoardId('board-lists')
const from = aList({ id: toListId('list-from'), boardId })
const to = aList({ id: toListId('list-to'), boardId })

describe('moveTask', () => {
  const task = aTask({ listId: from.id, position: 'V' })

  it('moves the task into another list between its new neighbours and raises TaskMoved', () => {
    const after = aTask({ listId: to.id, position: 'F' })
    const before = aTask({ listId: to.id, position: 'k' })

    const moved = moveTask(task, 'member', { toList: to, after, before })

    expect(moved.ok && moved.value.state.listId).toBe(to.id)
    const position = moved.ok ? moved.value.state.position : ''
    expect(position > 'F' && position < 'k').toBe(true)
    expect(moved.ok && moved.value.events).toEqual([
      {
        type: 'TaskMoved',
        payload: {
          taskId: task.id,
          boardId,
          fromListId: from.id,
          toListId: to.id,
        },
      },
    ])
  })

  it('moves the task into an empty list', () => {
    const moved = moveTask(task, 'member', { toList: to })

    expect(moved.ok && moved.value.state).toMatchObject({
      listId: to.id,
      position: 'V',
    })
  })

  it('reorders the task when the list is its own, raising TaskReordered', () => {
    const after = aTask({ listId: from.id, position: 'k' })

    const moved = moveTask(task, 'member', { toList: from, after })

    expect(moved.ok && moved.value.state.position > 'k').toBe(true)
    expect(moved.ok && moved.value.events).toEqual([
      {
        type: 'TaskReordered',
        payload: { taskId: task.id, boardId, listId: from.id },
      },
    ])
  })

  it('raises nothing for its own list without neighbours', () => {
    expect(moveTask(task, 'member', { toList: from })).toEqual({
      ok: true,
      value: { state: task, events: [] },
    })
  })

  it('returns ListArchivedError for a list archived since the page loaded', () => {
    expect(
      moveTask(task, 'member', { toList: { ...to, archived: true } })
    ).toEqual({ ok: false, error: new ListArchivedError() })
  })

  it('returns NotFoundError for a list on another board', () => {
    const elsewhere = aList({ boardId: toBoardId('board-elsewhere') })

    expect(moveTask(task, 'member', { toList: elsewhere })).toEqual({
      ok: false,
      error: new NotFoundError('List', elsewhere.id),
    })
  })

  it('returns NotFoundError for a neighbour that isn’t in the target list', () => {
    const stray = aTask({ listId: from.id })

    expect(moveTask(task, 'member', { toList: to, after: stray })).toEqual({
      ok: false,
      error: new NotFoundError('Task', stray.id),
    })
  })

  it('returns ConflictError for neighbours out of order', () => {
    const after = aTask({ listId: to.id, position: 'k' })
    const before = aTask({ listId: to.id, position: 'F' })

    expect(moveTask(task, 'member', { toList: to, after, before })).toEqual({
      ok: false,
      error: new ConflictError('Task', task.id),
    })
  })

  it('returns ForbiddenError for a user who isn’t a Board member', () => {
    expect(moveTask(task, undefined, { toList: to })).toEqual({
      ok: false,
      error: new ForbiddenError(),
    })
  })
})

describe('moveTask of an archived task', () => {
  it('returns TaskArchivedError', () => {
    const task = aTask({ listId: from.id, archived: true })

    expect(moveTask(task, 'member', { toList: to })).toEqual({
      ok: false,
      error: new TaskArchivedError(),
    })
  })
})
