import { describe, expect, it } from 'vitest'

import {
  addMember,
  archiveBoard,
  createBoard,
  leaveBoard,
  removeMember,
  renameBoard,
  restoreBoard,
  transferOwnership,
} from '@/modules/boards/domain/board/board'
import { toBoardId } from '@/modules/boards/domain/board/board-id'
import type { BoardName } from '@/modules/boards/domain/board/board-name'
import {
  AlreadyAMemberError,
  BoardArchivedError,
  BoardNameMismatchError,
  NotAMemberError,
  OwnerMustTransferFirstError,
} from '@/modules/boards/domain/board/board.errors'
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

// #region rename-board
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
// #endregion rename-board

describe('Board membership', () => {
  const owner = toUserId('user-owner')
  const member = toUserId('user-member')
  const cy = toUserId('user-cy')
  const outsider = toUserId('user-outsider')
  const board = aBoard({
    members: [
      { userId: owner, role: 'owner' },
      { userId: member, role: 'member' },
    ],
  })
  const ownerOnly = { ...board, members: [{ userId: owner, role: 'owner' }] }

  describe('addMember', () => {
    it('adds the user as a Member and raises MemberAdded', () => {
      expect(addMember(board, owner, cy)).toEqual({
        ok: true,
        value: {
          state: {
            ...board,
            members: [...board.members, { userId: cy, role: 'member' }],
          },
          events: [
            { type: 'MemberAdded', payload: { boardId: board.id, userId: cy } },
          ],
        },
      })
    })

    it.each([
      ['a Member', member],
      ['the Owner', owner],
    ])('returns AlreadyAMemberError for %s', (_who, userId) => {
      expect(addMember(board, owner, userId)).toEqual({
        ok: false,
        error: new AlreadyAMemberError(),
      })
    })

    it.each([
      ['a Member', member],
      ['a user who isn’t a Board member', outsider],
    ])('returns ForbiddenError for %s', (_who, actorId) => {
      expect(addMember(board, actorId, cy)).toEqual({
        ok: false,
        error: new ForbiddenError(),
      })
    })
  })

  describe('removeMember', () => {
    it('removes a Member and raises MemberRemoved', () => {
      expect(removeMember(board, owner, member)).toEqual({
        ok: true,
        value: {
          state: ownerOnly,
          events: [
            {
              type: 'MemberRemoved',
              payload: { boardId: board.id, userId: member },
            },
          ],
        },
      })
    })

    it('returns NotAMemberError for a user who isn’t a Board member', () => {
      expect(removeMember(board, owner, cy)).toEqual({
        ok: false,
        error: new NotAMemberError(),
      })
    })

    it('returns OwnerMustTransferFirstError when the Owner removes themself', () => {
      expect(removeMember(board, owner, owner)).toEqual({
        ok: false,
        error: new OwnerMustTransferFirstError(),
      })
    })

    it.each([
      ['a Member', member],
      ['a user who isn’t a Board member', outsider],
    ])('returns ForbiddenError for %s', (_who, actorId) => {
      expect(removeMember(board, actorId, member)).toEqual({
        ok: false,
        error: new ForbiddenError(),
      })
    })
  })

  describe('leaveBoard', () => {
    it('lets a Member leave and raises MemberLeft', () => {
      expect(leaveBoard(board, member)).toEqual({
        ok: true,
        value: {
          state: ownerOnly,
          events: [
            {
              type: 'MemberLeft',
              payload: { boardId: board.id, userId: member },
            },
          ],
        },
      })
    })

    it('returns OwnerMustTransferFirstError for the Owner', () => {
      expect(leaveBoard(board, owner)).toEqual({
        ok: false,
        error: new OwnerMustTransferFirstError(),
      })
    })

    it('returns ForbiddenError for a user who isn’t a Board member', () => {
      expect(leaveBoard(board, outsider)).toEqual({
        ok: false,
        error: new ForbiddenError(),
      })
    })
  })

  describe('transferOwnership', () => {
    it('makes the Member the Owner and the Owner a Member, raising OwnershipTransferred', () => {
      expect(transferOwnership(board, owner, member)).toEqual({
        ok: true,
        value: {
          state: {
            ...board,
            members: [
              { userId: owner, role: 'member' },
              { userId: member, role: 'owner' },
            ],
          },
          events: [
            {
              type: 'OwnershipTransferred',
              payload: {
                boardId: board.id,
                fromUserId: owner,
                toUserId: member,
              },
            },
          ],
        },
      })
    })

    it('returns NotAMemberError for a user who isn’t a Board member', () => {
      expect(transferOwnership(board, owner, cy)).toEqual({
        ok: false,
        error: new NotAMemberError(),
      })
    })

    it('raises nothing when the Owner transfers to themself', () => {
      expect(transferOwnership(board, owner, owner)).toEqual({
        ok: true,
        value: { state: board, events: [] },
      })
    })

    it.each([
      ['a Member', member],
      ['a user who isn’t a Board member', outsider],
    ])('returns ForbiddenError for %s', (_who, actorId) => {
      expect(transferOwnership(board, actorId, member)).toEqual({
        ok: false,
        error: new ForbiddenError(),
      })
    })
  })
})

describe('archiveBoard', () => {
  const ben = toUserId('user-ben')
  const board = aBoard({
    name: 'Launch plan' as BoardName,
    members: [
      { userId: ada, role: 'owner' },
      { userId: ben, role: 'member' },
    ],
  })

  it('archives the board when the Owner types its name, and raises BoardArchived', () => {
    expect(archiveBoard(board, ada, ' Launch plan ')).toEqual({
      ok: true,
      value: {
        state: { ...board, archived: true },
        events: [{ type: 'BoardArchived', payload: { boardId: board.id } }],
      },
    })
  })

  it('refuses a typed name that does not match', () => {
    const result = archiveBoard(board, ada, 'launch plan')

    expect(result.ok ? null : result.error).toBeInstanceOf(
      BoardNameMismatchError
    )
  })

  it('refuses a Member', () => {
    const result = archiveBoard(board, ben, 'Launch plan')

    expect(result.ok ? null : result.error).toBeInstanceOf(ForbiddenError)
  })

  it('raises nothing for a board already archived', () => {
    const archived = { ...board, archived: true }

    expect(archiveBoard(archived, ada, 'Launch plan')).toEqual({
      ok: true,
      value: { state: archived, events: [] },
    })
  })
})

describe('restoreBoard', () => {
  const ben = toUserId('user-ben')
  const board = aBoard({
    archived: true,
    members: [
      { userId: ada, role: 'owner' },
      { userId: ben, role: 'member' },
    ],
  })

  it('restores the board for the Owner, and raises BoardRestored', () => {
    expect(restoreBoard(board, ada)).toEqual({
      ok: true,
      value: {
        state: { ...board, archived: false },
        events: [{ type: 'BoardRestored', payload: { boardId: board.id } }],
      },
    })
  })

  it('refuses a Member', () => {
    const result = restoreBoard(board, ben)

    expect(result.ok ? null : result.error).toBeInstanceOf(ForbiddenError)
  })

  it('raises nothing for an active board', () => {
    const active = { ...board, archived: false }

    expect(restoreBoard(active, ada)).toEqual({
      ok: true,
      value: { state: active, events: [] },
    })
  })
})

describe('an archived board', () => {
  const ben = toUserId('user-ben')
  const cy = toUserId('user-cy')
  const board = aBoard({
    archived: true,
    members: [
      { userId: ada, role: 'owner' },
      { userId: ben, role: 'member' },
    ],
  })

  it.each([
    ['renameBoard', () => renameBoard(board, ada, 'New name')],
    ['addMember', () => addMember(board, ada, cy)],
    ['removeMember', () => removeMember(board, ada, ben)],
    ['leaveBoard', () => leaveBoard(board, ben)],
    ['transferOwnership', () => transferOwnership(board, ada, ben)],
  ])('refuses %s', (_name, change) => {
    const result = change()

    expect(result.ok ? null : result.error).toBeInstanceOf(BoardArchivedError)
  })

  it('still refuses a non-member as forbidden first', () => {
    const result = renameBoard(board, cy, 'New name')

    expect(result.ok ? null : result.error).toBeInstanceOf(ForbiddenError)
  })
})
