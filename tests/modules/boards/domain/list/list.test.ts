import { describe, expect, it } from 'vitest'

import { toBoardId } from '@/modules/boards/domain/board/board-id'
import {
  createList,
  moveList,
  renameList,
} from '@/modules/boards/domain/list/list'
import { toListId } from '@/modules/boards/domain/list/list-id'
import type { ListName } from '@/modules/boards/domain/list/list-name'
import { ConflictError, NotFoundError } from '@/shared/kernel/errors/app-error'
import {
  ForbiddenError,
  type ValidationError,
} from '@/shared/kernel/errors/domain-error'

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
      membership: 'member',
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
    expect(create({ membership: 'owner' }).ok).toBe(true)
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
    expect(create({ membership: undefined })).toEqual({
      ok: false,
      error: new ForbiddenError(),
    })
  })
})

describe('renameList', () => {
  const list = aList({ name: 'Backlog' as ListName })

  it('changes the name and raises ListRenamed with from and to', () => {
    expect(renameList(list, 'member', ' Ideas ')).toEqual({
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
    expect(renameList(list, 'owner', 'Backlog')).toEqual({
      ok: true,
      value: { state: list, events: [] },
    })
  })

  it('returns ValidationError for an invalid name', () => {
    expect(issues(renameList(list, 'member', ''))).toEqual({
      name: 'required',
    })
  })

  it('returns ForbiddenError for a user who isn’t a Board member', () => {
    expect(renameList(list, undefined, 'Ideas')).toEqual({
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
    const moved = moveList(last, 'member', { after: first, before: middle })

    expect(moved.ok).toBe(true)
    if (!moved.ok) return
    const { position } = moved.value.state
    expect(moved.value.state).toEqual({ ...last, position })
    expect(first.position < position && position < middle.position).toBe(true)
    expect(moved.value.events).toEqual(reordered(last))
  })

  it('moves a list first, before the first one', () => {
    const moved = moveList(last, 'owner', { before: first })

    expect(moved.ok && moved.value.state.position < first.position).toBe(true)
  })

  it('moves a list last, after the last one', () => {
    const moved = moveList(first, 'member', { after: last })

    expect(moved.ok && moved.value.state.position > last.position).toBe(true)
  })

  it('raises nothing with no neighbour to move next to', () => {
    expect(moveList(middle, 'member', {})).toEqual({
      ok: true,
      value: { state: middle, events: [] },
    })
  })

  it('returns ConflictError when the neighbours are out of order, as on a stale page', () => {
    expect(moveList(first, 'member', { after: last, before: middle })).toEqual({
      ok: false,
      error: new ConflictError('List', first.id),
    })
  })

  it('returns ConflictError when asked to move next to itself', () => {
    expect(moveList(middle, 'member', { after: middle })).toEqual({
      ok: false,
      error: new ConflictError('List', middle.id),
    })
  })

  it('returns NotFoundError for a neighbour on another board', () => {
    const elsewhere = aList({ boardId: toBoardId('board-other') })

    expect(moveList(middle, 'member', { after: elsewhere })).toEqual({
      ok: false,
      error: new NotFoundError('List', elsewhere.id),
    })
  })

  it('returns ForbiddenError for a user who isn’t a Board member', () => {
    expect(moveList(middle, undefined, { after: last })).toEqual({
      ok: false,
      error: new ForbiddenError(),
    })
  })
})
