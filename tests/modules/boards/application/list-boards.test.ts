import { beforeEach, describe, expect, it } from 'vitest'

import { listBoards, ValidationError } from '@/modules/boards/api'
import { resetMockStores } from '@/shared/infrastructure/mock-stores'
import { toUserId } from '@/shared/kernel/user-id'

beforeEach(() => {
  resetMockStores()
})

describe('listBoards', () => {
  it('returns no boards for a user who has none', async () => {
    expect(await listBoards({ actorId: toUserId('user-1') })).toEqual({
      ok: true,
      value: [],
    })
  })

  it('returns ValidationError without an actor', async () => {
    const result = await listBoards({ actorId: toUserId('') })

    expect(result.ok).toBe(false)
    expect(!result.ok && result.error).toBeInstanceOf(ValidationError)
  })
})
