import { beforeEach, describe, expect, it } from 'vitest'

import { seed, SEED_PASSWORD } from '@/di/seed/seed'
import { signIn } from '@/modules/identity/api'
import { resetMockStores } from '@/shared/infrastructure/mock-stores'

beforeEach(() => {
  resetMockStores()
})

describe('seed', () => {
  it.each(['ada@example.com', 'ben@example.com', 'cy@example.com'])(
    'lets %s sign in with the seed password',
    async (email) => {
      await seed()

      expect((await signIn({ email, password: SEED_PASSWORD })).ok).toBe(true)
    }
  )
})
