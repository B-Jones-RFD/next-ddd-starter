import { beforeEach, describe, expect, it, vi } from 'vitest'

import { getInjection } from '@/di/container'
import {
  addMember,
  AlreadyAMemberError,
  ConflictError,
  createBoard,
  ForbiddenError,
  getBoard,
  leaveBoard,
  listBoards,
  NotAMemberError,
  NotFoundError,
  OwnerMustTransferFirstError,
  removeMember,
  roleOf,
  searchUsers,
  transferOwnership,
  ValidationError,
} from '@/modules/boards/api'
import { resetMockStores } from '@/shared/infrastructure/mock-stores'
import { PersistenceError } from '@/shared/kernel/errors/infrastructure-error'
import { toUserId, type UserId } from '@/shared/kernel/user-id'

import { givenUser } from '@tests/fixtures/users'

let ada: UserId
let ben: UserId
let cy: UserId
let boardId: string

beforeEach(async () => {
  resetMockStores()
  ada = await givenUser('Ada', 'ada@example.com')
  ben = await givenUser('Ben', 'ben@example.com')
  cy = await givenUser('Cy', 'cy@example.com')
  const created = await createBoard({ actorId: ada, name: 'Launch plan' })
  if (!created.ok) throw new Error('setup failed')
  boardId = created.value.boardId
})

async function givenMember(userId: UserId) {
  const added = await addMember({ actorId: ada, boardId, userId })
  if (!added.ok) throw new Error('setup failed')
}

/** The board's members as Ada, its Owner, reads them. */
async function membersOf() {
  const board = await getBoard({ actorId: ada, boardId })
  if (!board.ok) throw new Error('Ada can’t read the board')
  return board.value.members.map((m) => [m.userId, m.role])
}

describe('addMember', () => {
  it('adds the user as a Member, who then sees the board on their grid', async () => {
    const result = await addMember({ actorId: ada, boardId, userId: ben })

    expect(result).toEqual({ ok: true, value: undefined })
    expect(await membersOf()).toEqual([
      [ada, 'owner'],
      [ben, 'member'],
    ])
    expect(await listBoards({ actorId: ben })).toEqual({
      ok: true,
      value: [
        {
          id: boardId,
          name: 'Launch plan',
          members: [
            { userId: ada, displayName: 'Ada', role: 'owner' },
            { userId: ben, displayName: 'Ben', role: 'member' },
          ],
        },
      ],
    })
  })

  it('returns AlreadyAMemberError for someone already on the board', async () => {
    await givenMember(ben)

    expect(await addMember({ actorId: ada, boardId, userId: ben })).toEqual({
      ok: false,
      error: new AlreadyAMemberError(),
    })
  })

  it('returns ForbiddenError for a Member, adding nobody', async () => {
    await givenMember(ben)

    expect(await addMember({ actorId: ben, boardId, userId: cy })).toEqual({
      ok: false,
      error: new ForbiddenError(),
    })
    expect((await getBoard({ actorId: cy, boardId })).ok).toBe(false)
  })

  it('returns NotFoundError for a user who isn’t registered', async () => {
    const result = await addMember({
      actorId: ada,
      boardId,
      userId: toUserId('user-nobody'),
    })

    expect(result).toEqual({
      ok: false,
      error: new NotFoundError('Person', 'user-nobody'),
    })
  })

  it('returns NotFoundError for a board that doesn’t exist', async () => {
    expect(
      await addMember({ actorId: ada, boardId: 'nowhere', userId: ben })
    ).toEqual({ ok: false, error: new NotFoundError('Board', 'nowhere') })
  })

  it('returns ValidationError without a user', async () => {
    const result = await addMember({
      actorId: ada,
      boardId,
      userId: toUserId(''),
    })

    expect(result.ok).toBe(false)
    expect(!result.ok && result.error).toBeInstanceOf(ValidationError)
  })

  it('returns ConflictError when the board changed since it was loaded', async () => {
    const boards = await getInjection('IBoardRepository')
    const findById = boards.findById.bind(boards)
    vi.spyOn(boards, 'findById').mockImplementationOnce(async (id) => {
      const stale = await findById(id)
      await addMember({ actorId: ada, boardId, userId: cy })
      return stale
    })

    expect(await addMember({ actorId: ada, boardId, userId: ben })).toEqual({
      ok: false,
      error: new ConflictError('Board', boardId),
    })
    expect(await membersOf()).toEqual([
      [ada, 'owner'],
      [cy, 'member'],
    ])
  })
})

describe('removeMember', () => {
  it('removes a Member, whose grid and board pages no longer show it', async () => {
    await givenMember(ben)

    const result = await removeMember({ actorId: ada, boardId, userId: ben })

    expect(result).toEqual({ ok: true, value: undefined })
    expect(await membersOf()).toEqual([[ada, 'owner']])
    expect(await listBoards({ actorId: ben })).toEqual({ ok: true, value: [] })
    expect(await getBoard({ actorId: ben, boardId })).toEqual({
      ok: false,
      error: new ForbiddenError(),
    })
  })

  it('returns NotAMemberError for a user who isn’t on the board', async () => {
    expect(await removeMember({ actorId: ada, boardId, userId: cy })).toEqual({
      ok: false,
      error: new NotAMemberError(),
    })
  })

  it('returns OwnerMustTransferFirstError when the Owner removes themself', async () => {
    expect(await removeMember({ actorId: ada, boardId, userId: ada })).toEqual({
      ok: false,
      error: new OwnerMustTransferFirstError(),
    })
  })

  it('returns ForbiddenError for a Member, removing nobody', async () => {
    await givenMember(ben)
    await givenMember(cy)

    expect(await removeMember({ actorId: ben, boardId, userId: cy })).toEqual({
      ok: false,
      error: new ForbiddenError(),
    })
    expect(await membersOf()).toHaveLength(3)
  })

  it('returns NotFoundError for a board that doesn’t exist', async () => {
    expect(
      await removeMember({ actorId: ada, boardId: 'nowhere', userId: ben })
    ).toEqual({ ok: false, error: new NotFoundError('Board', 'nowhere') })
  })
})

describe('leaveBoard', () => {
  it('lets a Member leave, taking the board off their grid', async () => {
    await givenMember(ben)

    const result = await leaveBoard({ actorId: ben, boardId })

    expect(result).toEqual({ ok: true, value: undefined })
    expect(await membersOf()).toEqual([[ada, 'owner']])
    expect(await listBoards({ actorId: ben })).toEqual({ ok: true, value: [] })
  })

  it('returns OwnerMustTransferFirstError for the Owner', async () => {
    expect(await leaveBoard({ actorId: ada, boardId })).toEqual({
      ok: false,
      error: new OwnerMustTransferFirstError(),
    })
  })

  it('returns ForbiddenError for a user who isn’t on the board', async () => {
    expect(await leaveBoard({ actorId: cy, boardId })).toEqual({
      ok: false,
      error: new ForbiddenError(),
    })
  })

  it('returns NotFoundError for a board that doesn’t exist', async () => {
    expect(await leaveBoard({ actorId: ben, boardId: 'nowhere' })).toEqual({
      ok: false,
      error: new NotFoundError('Board', 'nowhere'),
    })
  })
})

describe('transferOwnership', () => {
  it('makes the Member the Owner and the former Owner a Member', async () => {
    await givenMember(ben)

    const result = await transferOwnership({
      actorId: ada,
      boardId,
      userId: ben,
    })

    expect(result).toEqual({ ok: true, value: undefined })
    expect(await getBoard({ actorId: ada, boardId })).toMatchObject({
      ok: true,
      value: {
        role: 'member',
        members: [
          { userId: ben, role: 'owner' },
          { userId: ada, role: 'member' },
        ],
      },
    })
    // The former Owner can now leave, and the new one can't.
    expect((await leaveBoard({ actorId: ada, boardId })).ok).toBe(true)
    expect(await leaveBoard({ actorId: ben, boardId })).toEqual({
      ok: false,
      error: new OwnerMustTransferFirstError(),
    })
  })

  it('returns NotAMemberError for a user who isn’t on the board', async () => {
    expect(
      await transferOwnership({ actorId: ada, boardId, userId: cy })
    ).toEqual({ ok: false, error: new NotAMemberError() })
  })

  it('returns ForbiddenError for a Member, changing nothing', async () => {
    await givenMember(ben)

    expect(
      await transferOwnership({ actorId: ben, boardId, userId: ben })
    ).toEqual({ ok: false, error: new ForbiddenError() })
    expect(await membersOf()).toEqual([
      [ada, 'owner'],
      [ben, 'member'],
    ])
  })

  it('returns NotFoundError for a board that doesn’t exist', async () => {
    expect(
      await transferOwnership({ actorId: ada, boardId: 'nowhere', userId: ben })
    ).toEqual({ ok: false, error: new NotFoundError('Board', 'nowhere') })
  })
})

describe('searchUsers', () => {
  it('finds a user registered in identity, by email', async () => {
    const dee = await givenUser('Dee', 'dee@example.com')

    expect(
      await searchUsers({ actorId: ada, boardId, email: ' Dee@Example.com ' })
    ).toEqual({
      ok: true,
      value: [
        {
          userId: dee,
          displayName: 'Dee',
          email: 'dee@example.com',
          isMember: false,
        },
      ],
    })
  })

  it('marks someone already on the board', async () => {
    await givenMember(ben)

    expect(
      await searchUsers({ actorId: ada, boardId, email: 'ben@example.com' })
    ).toMatchObject({ ok: true, value: [{ userId: ben, isMember: true }] })
  })

  it('finds nobody for an email nobody registered', async () => {
    expect(
      await searchUsers({ actorId: ada, boardId, email: 'nobody@example.com' })
    ).toEqual({ ok: true, value: [] })
  })

  it('returns ValidationError for an address that isn’t an email', async () => {
    const result = await searchUsers({ actorId: ada, boardId, email: 'ben' })

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toBeInstanceOf(ValidationError)
    expect((result.error as ValidationError).fields).toEqual({
      email: 'invalid',
    })
  })

  it('returns ForbiddenError for a Member', async () => {
    await givenMember(ben)

    expect(
      await searchUsers({ actorId: ben, boardId, email: 'cy@example.com' })
    ).toEqual({ ok: false, error: new ForbiddenError() })
  })

  it('returns NotFoundError for a board that doesn’t exist', async () => {
    expect(
      await searchUsers({
        actorId: ada,
        boardId: 'nowhere',
        email: 'ben@example.com',
      })
    ).toEqual({ ok: false, error: new NotFoundError('Board', 'nowhere') })
  })

  it('throws an outage from identity as the directory’s own', async () => {
    vi.spyOn(
      await getInjection('IUserRepository'),
      'findByEmail'
    ).mockRejectedValueOnce(
      new PersistenceError('IUserRepository', { retryable: true })
    )

    await expect(
      searchUsers({ actorId: ada, boardId, email: 'ben@example.com' })
    ).rejects.toMatchObject({ port: 'IUserDirectory', retryable: true })
  })
})

describe('roleOf', () => {
  it('gives each user’s role on the board, and null for anyone else', async () => {
    await givenMember(ben)

    expect(await roleOf({ boardId, userId: ada })).toEqual({
      ok: true,
      value: 'owner',
    })
    expect(await roleOf({ boardId, userId: ben })).toEqual({
      ok: true,
      value: 'member',
    })
    expect(await roleOf({ boardId, userId: cy })).toEqual({
      ok: true,
      value: null,
    })
  })

  it('returns ValidationError without a board id', async () => {
    const result = await roleOf({ boardId: '', userId: ada })

    expect(result.ok).toBe(false)
    expect(!result.ok && result.error).toBeInstanceOf(ValidationError)
  })
})
