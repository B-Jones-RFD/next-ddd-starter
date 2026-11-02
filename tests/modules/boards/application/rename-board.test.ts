import { beforeEach, describe, expect, it, vi } from 'vitest'

import { getInjection } from '@/di/container'
import {
  ConflictError,
  createBoard,
  ForbiddenError,
  getBoard,
  NotFoundError,
  renameBoard,
  ValidationError,
} from '@/modules/boards/api'
import { resetMockStores } from '@/shared/infrastructure/mock-stores'
import type { UserId } from '@/shared/kernel/user-id'

import { givenUser } from '@tests/fixtures/users'

let ada: UserId
let boardId: string

beforeEach(async () => {
  resetMockStores()
  ada = await givenUser('Ada')
  const created = await createBoard({ actorId: ada, name: 'Launch plan' })
  if (!created.ok) throw new Error('setup failed')
  boardId = created.value.boardId
})

async function nameOf(id: string) {
  const board = await getBoard({ actorId: ada, boardId: id })
  return board.ok ? board.value.name : undefined
}

describe('renameBoard', () => {
  it('lets the Owner rename the board', async () => {
    const result = await renameBoard({
      actorId: ada,
      boardId,
      name: ' Launch plan v2 ',
    })

    expect(result).toEqual({ ok: true, value: undefined })
    expect(await nameOf(boardId)).toBe('Launch plan v2')
  })

  it('returns ValidationError for an invalid name, changing nothing', async () => {
    const result = await renameBoard({ actorId: ada, boardId, name: '  ' })

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toBeInstanceOf(ValidationError)
    expect((result.error as ValidationError).fields).toEqual({
      name: 'required',
    })
    expect(await nameOf(boardId)).toBe('Launch plan')
  })

  it('returns ForbiddenError for a user who isn’t the Owner', async () => {
    const ben = await givenUser('Ben')

    const result = await renameBoard({ actorId: ben, boardId, name: 'Mine' })

    expect(result).toEqual({ ok: false, error: new ForbiddenError() })
    expect(await nameOf(boardId)).toBe('Launch plan')
  })

  it('returns NotFoundError for a board that doesn’t exist', async () => {
    const result = await renameBoard({
      actorId: ada,
      boardId: 'nowhere',
      name: 'Anything',
    })

    expect(result).toEqual({
      ok: false,
      error: new NotFoundError('Board', 'nowhere'),
    })
  })

  it('returns ConflictError when the board changed since it was loaded, keeping the other change', async () => {
    const boards = await getInjection('IBoardRepository')
    const findById = boards.findById.bind(boards)
    // Another rename lands between this rename's load and its save.
    vi.spyOn(boards, 'findById').mockImplementationOnce(async (id) => {
      const stale = await findById(id)
      await renameBoard({ actorId: ada, boardId, name: 'Their name' })
      return stale
    })

    const result = await renameBoard({ actorId: ada, boardId, name: 'My name' })

    expect(result).toEqual({
      ok: false,
      error: new ConflictError('Board', boardId),
    })
    expect(await nameOf(boardId)).toBe('Their name')
  })
})

describe('getBoard', () => {
  it('returns the board with the reader’s role and its members', async () => {
    expect(await getBoard({ actorId: ada, boardId })).toEqual({
      ok: true,
      value: {
        id: boardId,
        name: 'Launch plan',
        archived: false,
        role: 'owner',
        members: [{ userId: ada, displayName: 'Ada', role: 'owner' }],
        lists: [],
      },
    })
  })

  it('returns ForbiddenError for a user who isn’t a Board member', async () => {
    const cy = await givenUser('Cy')

    expect(await getBoard({ actorId: cy, boardId })).toEqual({
      ok: false,
      error: new ForbiddenError(),
    })
  })

  it('returns NotFoundError for a board that doesn’t exist', async () => {
    expect(await getBoard({ actorId: ada, boardId: 'nowhere' })).toEqual({
      ok: false,
      error: new NotFoundError('Board', 'nowhere'),
    })
  })

  it('returns ValidationError without a board id', async () => {
    const result = await getBoard({ actorId: ada, boardId: '' })

    expect(result.ok).toBe(false)
    expect(!result.ok && result.error).toBeInstanceOf(ValidationError)
  })
})
