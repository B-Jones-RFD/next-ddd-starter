import { describe, expect, it } from 'vitest'

import {
  addMember,
  archiveBoard,
  createBoard,
  createTag,
  deleteTag,
  leaveBoard,
  recolorTag,
  removeMember,
  renameBoard,
  restoreBoard,
  renameTag,
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
  TagNameTakenError,
} from '@/modules/boards/domain/board/board.errors'
import { toTagId, type Tag } from '@/modules/boards/domain/board/tag'
import type { TagName } from '@/modules/boards/domain/board/tag-name'
import { NotFoundError } from '@/shared/kernel/errors/app-error'
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
          tags: [],
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
  const tag: Tag = {
    id: toTagId('tag-urgent'),
    name: 'Urgent' as TagName,
    color: 'red',
  }
  const board = aBoard({
    archived: true,
    members: [
      { userId: ada, role: 'owner' },
      { userId: ben, role: 'member' },
    ],
    tags: [tag],
  })

  it.each([
    ['renameBoard', () => renameBoard(board, ada, 'New name')],
    ['addMember', () => addMember(board, ada, cy)],
    ['removeMember', () => removeMember(board, ada, ben)],
    ['leaveBoard', () => leaveBoard(board, ben)],
    ['transferOwnership', () => transferOwnership(board, ada, ben)],
    [
      'createTag',
      () =>
        createTag(board, ben, {
          id: toTagId('tag-new'),
          name: 'New',
          color: 'teal',
        }),
    ],
    ['renameTag', () => renameTag(board, ben, tag.id, 'Later')],
    ['recolorTag', () => recolorTag(board, ben, tag.id, 'blue')],
    ['deleteTag', () => deleteTag(board, ben, tag.id)],
  ])('refuses %s', (_name, change) => {
    const result = change()

    expect(result.ok ? null : result.error).toBeInstanceOf(BoardArchivedError)
  })

  it('still refuses a non-member as forbidden first', () => {
    const result = renameBoard(board, cy, 'New name')

    expect(result.ok ? null : result.error).toBeInstanceOf(ForbiddenError)
  })
})
describe('Tags', () => {
  const owner = toUserId('user-owner')
  const member = toUserId('user-member')
  const outsider = toUserId('user-outsider')
  const urgent: Tag = {
    id: toTagId('tag-urgent'),
    name: 'Urgent' as TagName,
    color: 'red',
  }
  const board = aBoard({
    members: [
      { userId: owner, role: 'owner' },
      { userId: member, role: 'member' },
    ],
    tags: [urgent],
  })

  describe('createTag', () => {
    const create = (overrides: Partial<Parameters<typeof createTag>[2]> = {}) =>
      createTag(board, member, {
        id: toTagId('tag-new'),
        name: ' Design ',
        color: 'teal',
        ...overrides,
      })

    it('lets any Board member add a tag and raises TagCreated', () => {
      expect(create()).toEqual({
        ok: true,
        value: {
          state: {
            ...board,
            tags: [urgent, { id: 'tag-new', name: 'Design', color: 'teal' }],
          },
          events: [
            {
              type: 'TagCreated',
              payload: {
                boardId: board.id,
                tagId: 'tag-new',
                name: 'Design',
                color: 'teal',
              },
            },
          ],
        },
      })
    })

    it.each([
      ['', { name: 'required' }],
      ['x'.repeat(61), { name: 'too-long' }],
    ])('returns ValidationError for the name %j', (name, fields) => {
      expect(issues(create({ name }))).toEqual(fields)
    })

    it('returns ValidationError for a color outside the palette', () => {
      expect(issues(create({ color: 'pink' }))).toEqual({ color: 'invalid' })
    })

    it('reports a bad name and a bad color together', () => {
      expect(issues(create({ name: ' ', color: '#ff0000' }))).toEqual({
        name: 'required',
        color: 'invalid',
      })
    })

    it('returns TagNameTakenError for a name already on the board, in any case', () => {
      expect(create({ name: ' urgent ' })).toEqual({
        ok: false,
        error: new TagNameTakenError(),
      })
    })

    it('returns ForbiddenError for a user who isn’t a Board member', () => {
      expect(
        createTag(board, outsider, {
          id: toTagId('x'),
          name: 'X',
          color: 'red',
        })
      ).toEqual({ ok: false, error: new ForbiddenError() })
    })
  })

  describe('renameTag', () => {
    const design: Tag = {
      id: toTagId('tag-design'),
      name: 'Design' as TagName,
      color: 'violet',
    }
    const twoTags = { ...board, tags: [urgent, design] }

    it('renames the tag and raises TagRenamed with from and to', () => {
      expect(renameTag(twoTags, member, design.id, ' UX ')).toEqual({
        ok: true,
        value: {
          state: { ...twoTags, tags: [urgent, { ...design, name: 'UX' }] },
          events: [
            {
              type: 'TagRenamed',
              payload: {
                boardId: board.id,
                tagId: design.id,
                from: 'Design',
                to: 'UX',
              },
            },
          ],
        },
      })
    })

    it('raises nothing when the name doesn’t change', () => {
      expect(renameTag(twoTags, member, design.id, 'Design')).toEqual({
        ok: true,
        value: { state: twoTags, events: [] },
      })
    })

    it('lets a tag change only the case of its own name', () => {
      const renamed = renameTag(twoTags, member, design.id, 'DESIGN')
      expect(renamed.ok && renamed.value.state.tags[1]?.name).toBe('DESIGN')
    })

    it('returns TagNameTakenError for another tag’s name', () => {
      expect(renameTag(twoTags, member, design.id, 'URGENT')).toEqual({
        ok: false,
        error: new TagNameTakenError(),
      })
    })

    it('returns ValidationError for an invalid name', () => {
      expect(issues(renameTag(twoTags, member, design.id, ''))).toEqual({
        name: 'required',
      })
    })

    it('returns NotFoundError for a tag that isn’t on the board', () => {
      expect(renameTag(twoTags, member, toTagId('tag-gone'), 'X')).toEqual({
        ok: false,
        error: new NotFoundError('Tag', 'tag-gone'),
      })
    })

    it('returns ForbiddenError for a user who isn’t a Board member', () => {
      expect(renameTag(twoTags, outsider, design.id, 'X')).toEqual({
        ok: false,
        error: new ForbiddenError(),
      })
    })
  })

  describe('recolorTag', () => {
    it('changes the color and raises TagRecolored with from and to', () => {
      expect(recolorTag(board, member, urgent.id, 'amber')).toEqual({
        ok: true,
        value: {
          state: { ...board, tags: [{ ...urgent, color: 'amber' }] },
          events: [
            {
              type: 'TagRecolored',
              payload: {
                boardId: board.id,
                tagId: urgent.id,
                from: 'red',
                to: 'amber',
              },
            },
          ],
        },
      })
    })

    it('raises nothing when the color doesn’t change', () => {
      expect(recolorTag(board, member, urgent.id, 'red')).toEqual({
        ok: true,
        value: { state: board, events: [] },
      })
    })

    it('returns ValidationError for a color outside the palette', () => {
      expect(issues(recolorTag(board, member, urgent.id, 'pink'))).toEqual({
        color: 'invalid',
      })
    })

    it('returns NotFoundError for a tag that isn’t on the board', () => {
      expect(recolorTag(board, member, toTagId('tag-gone'), 'red')).toEqual({
        ok: false,
        error: new NotFoundError('Tag', 'tag-gone'),
      })
    })

    it('returns ForbiddenError for a user who isn’t a Board member', () => {
      expect(recolorTag(board, outsider, urgent.id, 'blue')).toEqual({
        ok: false,
        error: new ForbiddenError(),
      })
    })
  })

  describe('deleteTag', () => {
    it('removes the tag and raises TagDeleted with its name', () => {
      expect(deleteTag(board, member, urgent.id)).toEqual({
        ok: true,
        value: {
          state: { ...board, tags: [] },
          events: [
            {
              type: 'TagDeleted',
              payload: { boardId: board.id, tagId: urgent.id, name: 'Urgent' },
            },
          ],
        },
      })
    })

    it('returns NotFoundError for a tag that isn’t on the board', () => {
      expect(deleteTag(board, member, toTagId('tag-gone'))).toEqual({
        ok: false,
        error: new NotFoundError('Tag', 'tag-gone'),
      })
    })

    it('returns ForbiddenError for a user who isn’t a Board member', () => {
      expect(deleteTag(board, outsider, urgent.id)).toEqual({
        ok: false,
        error: new ForbiddenError(),
      })
    })
  })
})
