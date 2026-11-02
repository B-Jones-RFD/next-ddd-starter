import { beforeEach, describe, expect, it, vi } from 'vitest'

import { getInjection } from '@/di/container'
import {
  createBoard,
  getBoard,
  listBoards,
  ValidationError,
} from '@/modules/boards/api'
import { resetMockStores } from '@/shared/infrastructure/mock-stores'
import { PersistenceError } from '@/shared/kernel/errors/infrastructure-error'

import { givenUser } from '@tests/fixtures/users'

beforeEach(() => {
  resetMockStores()
})

describe('createBoard', () => {
  it('creates a board with its creator as Owner, listed for them', async () => {
    const ada = await givenUser('Ada')

    const created = await createBoard({ actorId: ada, name: ' Launch plan ' })

    expect(created).toEqual({
      ok: true,
      value: { boardId: expect.any(String) },
    })
    if (!created.ok) return
    expect(await listBoards({ actorId: ada })).toEqual({
      ok: true,
      value: [
        {
          id: created.value.boardId,
          name: 'Launch plan',
          members: [{ userId: ada, displayName: 'Ada', role: 'owner' }],
        },
      ],
    })
    expect(
      await getBoard({ actorId: ada, boardId: created.value.boardId })
    ).toMatchObject({ ok: true, value: { name: 'Launch plan', role: 'owner' } })
  })

  it.each([
    ['', 'required'],
    ['x'.repeat(61), 'too-long'],
  ])('returns ValidationError for the name %j', async (name, issue) => {
    const ada = await givenUser('Ada')

    const result = await createBoard({ actorId: ada, name })

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toBeInstanceOf(ValidationError)
    expect((result.error as ValidationError).fields).toEqual({ name: issue })
    expect(await listBoards({ actorId: ada })).toEqual({ ok: true, value: [] })
  })

  // #region outage
  it('throws an outage from the repository', async () => {
    const ada = await givenUser('Ada')
    const outage = new PersistenceError('IBoardRepository', { retryable: true })
    vi.spyOn(
      await getInjection('IBoardRepository'),
      'save'
    ).mockRejectedValueOnce(outage)

    await expect(
      createBoard({ actorId: ada, name: 'Launch plan' })
    ).rejects.toBe(outage)
  })
  // #endregion outage
})
