import { describe, expect, it } from 'vitest'

import { BoardArchivedError } from '@/modules/boards/domain/board/board.errors'
import { toBoardId } from '@/modules/boards/domain/board/board-id'
import {
  createList,
  moveList,
  renameList,
  restoreList,
} from '@/modules/boards/domain/list/list'
import { ListArchivedError } from '@/modules/boards/domain/list/list.errors'
import { toListId } from '@/modules/boards/domain/list/list-id'
import type { ListName } from '@/modules/boards/domain/list/list-name'
import { ConflictError, NotFoundError } from '@/shared/kernel/errors/app-error'
import {
  ForbiddenError,
  type ValidationError,
} from '@/shared/kernel/errors/domain-error'

import { asMember, asOutsider, onArchivedBoard } from '@tests/fixtures/boards'
import { aList } from '@tests/fixtures/lists'

const now = new Date('2026-01-01T10:00:00.000Z')
const boardId = toBoardId('board-lists')

const issues = (result: { ok: boolean; error?: unknown }) =>
  result.ok ? undefined : (result.error as ValidationError).fields

describe('createList', () => {
  const create = (overrides: Partial<Parameters<typeof createList>[0]> = {}) =>
    createList({
      id: toListId('list-new'),
      boardId,
      membership: asMember(),
      name: ' Backlog ',
      after: null,
      now,
      ...overrides,
    })

  it('creates an active list at version 0 and raises ListCreated', () => {
    expect(create()).toEqual({
      ok: true,
      value: {
        state: {
          id: 'list-new',
          boardId,
          name: 'Backlog',
          position: 'V',
          archived: false,
          createdAt: now,
          version: 0,
        },
        events: [
          {
            type: 'ListCreated',
            payload: { listId: 'list-new', boardId, name: 'Backlog' },
          },
        ],
      },
    })
  })

  it('places the list after the last one', () => {
    const created = create({ after: 'V' })

    expect(created.ok && created.value.state.position > 'V').toBe(true)
  })

  it('lets the Owner create a list', () => {
    expect(create({ membership: asMember('owner') }).ok).toBe(true)
  })

  it.each([
    ['', 'required'],
    ['   ', 'required'],
    ['x'.repeat(61), 'too-long'],
  ])('rejects the name %j as %s', (name, issue) => {
    expect(issues(create({ name }))).toEqual({ name: issue })
  })

  it('accepts a name of 60 characters', () => {
    expect(create({ name: 'x'.repeat(60) }).ok).toBe(true)
  })

  it('returns ForbiddenError for a user who isn’t a Board member', () => {
    expect(create({ membership: asOutsider })).toEqual({
      ok: false,
      error: new ForbiddenError(),
    })
  })
})

describe('renameList', () => {
  const list = aList({ name: 'Backlog' as ListName })

  it('changes the name and raises ListRenamed with from and to', () => {
    expect(renameList(list, asMember(), ' Ideas ')).toEqual({
      ok: true,
      value: {
        state: { ...list, name: 'Ideas' },
        events: [
          {
            type: 'ListRenamed',
            payload: {
              listId: list.id,
              boardId: list.boardId,
              from: 'Backlog',
              to: 'Ideas',
            },
          },
        ],
      },
    })
  })

  it('raises nothing when the name doesn’t change', () => {
    expect(renameList(list, asMember('owner'), 'Backlog')).toEqual({
      ok: true,
      value: { state: list, events: [] },
    })
  })

  it('returns ValidationError for an invalid name', () => {
    expect(issues(renameList(list, asMember(), ''))).toEqual({
      name: 'required',
    })
  })

  it('returns ForbiddenError for a user who isn’t a Board member', () => {
    expect(renameList(list, asOutsider, 'Ideas')).toEqual({
      ok: false,
      error: new ForbiddenError(),
    })
  })
})

describe('moveList', () => {
  const first = aList({ position: 'G' })
  const middle = aList({ position: 'V' })
  const last = aList({ position: 'l' })

  const reordered = (list: typeof middle) => [
    { type: 'ListReordered', payload: { listId: list.id, boardId } },
  ]

  it('moves a list between two others, changing only its position', () => {
    const moved = moveList(last, asMember(), { after: first, before: middle })

    expect(moved.ok).toBe(true)
    if (!moved.ok) return
    const { position } = moved.value.state
    expect(moved.value.state).toEqual({ ...last, position })
    expect(first.position < position && position < middle.position).toBe(true)
    expect(moved.value.events).toEqual(reordered(last))
  })

  it('moves a list first, before the first one', () => {
    const moved = moveList(last, asMember('owner'), { before: first })

    expect(moved.ok && moved.value.state.position < first.position).toBe(true)
  })

  it('moves a list last, after the last one', () => {
    const moved = moveList(first, asMember(), { after: last })

    expect(moved.ok && moved.value.state.position > last.position).toBe(true)
  })

  it('raises nothing with no neighbour to move next to', () => {
    expect(moveList(middle, asMember(), {})).toEqual({
      ok: true,
      value: { state: middle, events: [] },
    })
  })

  it('returns ConflictError when the neighbours are out of order, as on a stale page', () => {
    expect(
      moveList(first, asMember(), { after: last, before: middle })
    ).toEqual({
      ok: false,
      error: new ConflictError('List', first.id),
    })
  })

  it('returns ConflictError when asked to move next to itself', () => {
    expect(moveList(middle, asMember(), { after: middle })).toEqual({
      ok: false,
      error: new ConflictError('List', middle.id),
    })
  })

  it('returns NotFoundError for a neighbour on another board', () => {
    const elsewhere = aList({ boardId: toBoardId('board-other') })

    expect(moveList(middle, asMember(), { after: elsewhere })).toEqual({
      ok: false,
      error: new NotFoundError('List', elsewhere.id),
    })
  })

  it('returns ForbiddenError for a user who isn’t a Board member', () => {
    expect(moveList(middle, asOutsider, { after: last })).toEqual({
      ok: false,
      error: new ForbiddenError(),
    })
  })
})

describe('restoreList', () => {
  const list = aList({ archived: true, position: 'k' })

  it('restores the list in its old place and raises ListRestored', () => {
    expect(restoreList(list, asMember())).toEqual({
      ok: true,
      value: {
        state: { ...list, archived: false },
        events: [
          {
            type: 'ListRestored',
            payload: { listId: list.id, boardId: list.boardId },
          },
        ],
      },
    })
  })

  it('raises nothing for an active list', () => {
    const active = aList()

    expect(restoreList(active, asMember('owner'))).toEqual({
      ok: true,
      value: { state: active, events: [] },
    })
  })

  it('returns ForbiddenError for a user who isn’t a Board member', () => {
    expect(restoreList(list, asOutsider)).toEqual({
      ok: false,
      error: new ForbiddenError(),
    })
  })
})

describe('an archived list', () => {
  const list = aList({ archived: true })
  const other = aList({ position: 'l' })

  it.each([
    ['renameList', () => renameList(list, asMember(), 'Ideas')],
    ['moveList', () => moveList(list, asMember(), { after: other })],
  ])('refuses %s', (_name, change) => {
    expect(change()).toEqual({ ok: false, error: new ListArchivedError() })
  })
})

describe('a list on an archived board', () => {
  const list = aList()
  const archived = aList({ archived: true })
  const other = aList({ position: 'l' })

  it.each([
    [
      'createList',
      () =>
        createList({
          id: toListId('list-new'),
          boardId: list.boardId,
          membership: onArchivedBoard,
          name: 'Later',
          after: null,
          now: new Date(),
        }),
    ],
    ['renameList', () => renameList(list, onArchivedBoard, 'Ideas')],
    ['moveList', () => moveList(list, onArchivedBoard, { after: other })],
    ['restoreList', () => restoreList(archived, onArchivedBoard)],
  ])('refuses %s', (_name, change) => {
    expect(change()).toEqual({ ok: false, error: new BoardArchivedError() })
  })
})
