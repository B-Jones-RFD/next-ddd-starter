import { describe, expect, it } from 'vitest'

import { toBoardId } from '@/modules/boards/domain/board/board-id'
import { ListArchivedError } from '@/modules/boards/domain/list/list.errors'
import { toListId } from '@/modules/boards/domain/list/list-id'
import {
  changeTaskDescription,
  createTask,
  renameTask,
  reorderTask,
} from '@/modules/boards/domain/task/task'
import type { TaskDescription } from '@/modules/boards/domain/task/task-description'
import { toTaskId } from '@/modules/boards/domain/task/task-id'
import type { TaskTitle } from '@/modules/boards/domain/task/task-title'
import { ConflictError, NotFoundError } from '@/shared/kernel/errors/app-error'
import {
  ForbiddenError,
  type ValidationError,
} from '@/shared/kernel/errors/domain-error'

import { aList } from '@tests/fixtures/lists'
import { aTask } from '@tests/fixtures/tasks'

const now = new Date('2026-01-01T10:00:00.000Z')
const boardId = toBoardId('board-lists')
const listId = toListId('list-tasks')

const issues = (result: { ok: boolean; error?: unknown }) =>
  result.ok ? undefined : (result.error as ValidationError).fields

describe('createTask', () => {
  const list = aList({ id: listId, boardId })
  const create = (overrides: Partial<Parameters<typeof createTask>[0]> = {}) =>
    createTask({
      id: toTaskId('task-new'),
      list,
      membership: 'member',
      title: ' Write the brief ',
      after: null,
      now,
      ...overrides,
    })

  it('creates an active task with no description or assignees at version 0 and raises TaskCreated', () => {
    expect(create()).toEqual({
      ok: true,
      value: {
        state: {
          id: 'task-new',
          boardId,
          listId,
          title: 'Write the brief',
          description: '',
          position: 'V',
          assignees: [],
          archived: false,
          createdAt: now,
          version: 0,
        },
        events: [
          {
            type: 'TaskCreated',
            payload: {
              taskId: 'task-new',
              boardId,
              listId,
              title: 'Write the brief',
            },
          },
        ],
      },
    })
  })

  it('places the task after the list’s last one', () => {
    const created = create({ after: 'V' })

    expect(created.ok && created.value.state.position > 'V').toBe(true)
  })

  it.each([
    ['', 'required'],
    ['  ', 'required'],
    ['x'.repeat(201), 'too-long'],
  ])('rejects the title %j as %s', (title, issue) => {
    expect(issues(create({ title }))).toEqual({ title: issue })
  })

  it('accepts a title of 200 characters', () => {
    expect(create({ title: 'x'.repeat(200) }).ok).toBe(true)
  })

  it('returns ForbiddenError for a user who isn’t a Board member', () => {
    expect(create({ membership: undefined })).toEqual({
      ok: false,
      error: new ForbiddenError(),
    })
  })

  it('returns ListArchivedError for an archived list', () => {
    expect(create({ list: aList({ archived: true }) })).toEqual({
      ok: false,
      error: new ListArchivedError(),
    })
  })
})

describe('renameTask', () => {
  const task = aTask({ title: 'Draft' as TaskTitle })

  it('renames the task and raises TaskRenamed with from and to', () => {
    expect(renameTask(task, 'member', ' Final ')).toEqual({
      ok: true,
      value: {
        state: { ...task, title: 'Final' },
        events: [
          {
            type: 'TaskRenamed',
            payload: {
              taskId: task.id,
              boardId: task.boardId,
              from: 'Draft',
              to: 'Final',
            },
          },
        ],
      },
    })
  })

  it('raises nothing for the same title', () => {
    expect(renameTask(task, 'member', 'Draft ')).toEqual({
      ok: true,
      value: { state: task, events: [] },
    })
  })

  it('rejects an empty title', () => {
    expect(issues(renameTask(task, 'member', ''))).toEqual({
      title: 'required',
    })
  })

  it('returns ForbiddenError for a user who isn’t a Board member', () => {
    expect(renameTask(task, undefined, 'Final')).toEqual({
      ok: false,
      error: new ForbiddenError(),
    })
  })
})

describe('changeTaskDescription', () => {
  const task = aTask({ description: 'Old' as TaskDescription })

  it('changes the description and raises TaskDescriptionChanged with from and to', () => {
    expect(changeTaskDescription(task, 'owner', ' New\nlines ')).toEqual({
      ok: true,
      value: {
        state: { ...task, description: 'New\nlines' },
        events: [
          {
            type: 'TaskDescriptionChanged',
            payload: {
              taskId: task.id,
              boardId: task.boardId,
              from: 'Old',
              to: 'New\nlines',
            },
          },
        ],
      },
    })
  })

  it('lets the description be cleared', () => {
    const changed = changeTaskDescription(task, 'member', '   ')

    expect(changed.ok && changed.value.state.description).toBe('')
  })

  it('raises nothing for the same description', () => {
    expect(changeTaskDescription(task, 'member', 'Old')).toEqual({
      ok: true,
      value: { state: task, events: [] },
    })
  })

  it('rejects a description over 5000 characters, accepting 5000', () => {
    expect(
      issues(changeTaskDescription(task, 'member', 'x'.repeat(5001)))
    ).toEqual({ description: 'too-long' })
    expect(changeTaskDescription(task, 'member', 'x'.repeat(5000)).ok).toBe(
      true
    )
  })

  it('returns ForbiddenError for a user who isn’t a Board member', () => {
    expect(changeTaskDescription(task, undefined, 'New')).toEqual({
      ok: false,
      error: new ForbiddenError(),
    })
  })
})

describe('reorderTask', () => {
  const first = aTask({ position: 'F' })
  const second = aTask({ position: 'V' })
  const third = aTask({ position: 'k' })

  it('moves the task between its new neighbours and raises TaskReordered', () => {
    const moved = reorderTask(first, 'member', { after: second, before: third })

    expect(moved.ok && moved.value.state.position > 'V').toBe(true)
    expect(moved.ok && moved.value.state.position < 'k').toBe(true)
    expect(moved.ok && moved.value.events).toEqual([
      {
        type: 'TaskReordered',
        payload: { taskId: first.id, boardId, listId },
      },
    ])
  })

  it('moves the task first or last with one neighbour', () => {
    const top = reorderTask(third, 'member', { before: first })
    const bottom = reorderTask(first, 'member', { after: third })

    expect(top.ok && top.value.state.position < 'F').toBe(true)
    expect(bottom.ok && bottom.value.state.position > 'k').toBe(true)
  })

  it('raises nothing without neighbours', () => {
    expect(reorderTask(first, 'member', {})).toEqual({
      ok: true,
      value: { state: first, events: [] },
    })
  })

  it('returns NotFoundError for a neighbour in another list', () => {
    const elsewhere = aTask({ listId: toListId('list-other') })

    expect(reorderTask(first, 'member', { after: elsewhere })).toEqual({
      ok: false,
      error: new NotFoundError('Task', elsewhere.id),
    })
  })

  it('returns ConflictError for neighbours out of order, or itself as a neighbour', () => {
    expect(
      reorderTask(first, 'member', { after: third, before: second })
    ).toEqual({ ok: false, error: new ConflictError('Task', first.id) })
    expect(reorderTask(first, 'member', { after: first })).toEqual({
      ok: false,
      error: new ConflictError('Task', first.id),
    })
  })

  it('returns ForbiddenError for a user who isn’t a Board member', () => {
    expect(reorderTask(first, undefined, { after: second })).toEqual({
      ok: false,
      error: new ForbiddenError(),
    })
  })
})
