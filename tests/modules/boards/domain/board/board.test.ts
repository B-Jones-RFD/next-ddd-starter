import { describe, expect, it } from 'vitest'

import { createBoard, renameBoard } from '@/modules/boards/domain/board/board'
import { toBoardId } from '@/modules/boards/domain/board/board-id'
import type { BoardName } from '@/modules/boards/domain/board/board-name'
import {
  ForbiddenError,
  type ValidationError,
} from '@/shared/kernel/errors/domain-error'
import { toUserId } from '@/shared/kernel/user-id'

import { aBoard } from '@tests/fixtures/boards'

const ada = toUserId('user-ada')
const now = new Date('2026-01-01T10:00:00.000Z')

const issues = (result: { ok: boolean; error?: unknown }) =>
  result.ok ? undefined : (result.error as ValidationError).fields

describe('createBoard', () => {
  it('creates an active board at version 0 with its creator as the one Owner', () => {
    const result = createBoard({
      id: toBoardId('board-1'),
      actorId: ada,
      name: '  Launch plan ',
      now,
    })

    expect(result).toEqual({
      ok: true,
      value: {
        state: {
          id: 'board-1',
          name: 'Launch plan',
          members: [{ userId: ada, role: 'owner' }],
          archived: false,
          createdAt: now,
          version: 0,
        },
        events: [
          {
            type: 'BoardCreated',
            payload: { boardId: 'board-1', name: 'Launch plan' },
          },
        ],
      },
    })
  })

  it.each([
    ['', 'required'],
    ['   ', 'required'],
    ['x'.repeat(61), 'too-long'],
  ])('rejects the name %j as %s', (name, issue) => {
    const result = createBoard({
      id: toBoardId('board-1'),
      actorId: ada,
      name,
      now,
    })

    expect(issues(result)).toEqual({ name: issue })
  })

  it('accepts a name of 60 characters', () => {
    const result = createBoard({
      id: toBoardId('board-1'),
      actorId: ada,
      name: 'x'.repeat(60),
      now,
    })

    expect(result.ok).toBe(true)
  })
})

describe('renameBoard', () => {
  const owner = toUserId('user-owner')
  const member = toUserId('user-member')
  const board = aBoard({
    name: 'Launch plan' as BoardName,
    members: [
      { userId: owner, role: 'owner' },
      { userId: member, role: 'member' },
    ],
  })

  it('changes the name and raises BoardRenamed with from and to', () => {
    expect(renameBoard(board, owner, ' Launch plan v2 ')).toEqual({
      ok: true,
      value: {
        state: { ...board, name: 'Launch plan v2' },
        events: [
          {
            type: 'BoardRenamed',
            payload: {
              boardId: board.id,
              from: 'Launch plan',
              to: 'Launch plan v2',
            },
          },
        ],
      },
    })
  })

  it('raises nothing when the name doesn’t change', () => {
    expect(renameBoard(board, owner, 'Launch plan')).toEqual({
      ok: true,
      value: { state: board, events: [] },
    })
  })

  it('returns ValidationError for an invalid name', () => {
    expect(issues(renameBoard(board, owner, ' '))).toEqual({
      name: 'required',
    })
  })

  it.each([
    ['a Member', member],
    ['a user who isn’t a Board member', toUserId('user-outsider')],
  ])('returns ForbiddenError for %s', (_who, actorId) => {
    expect(renameBoard(board, actorId, 'Mine now')).toEqual({
      ok: false,
      error: new ForbiddenError(),
    })
  })
})
