import { describe, expect, it } from 'vitest'

import type { IPasswordHasher } from '@/modules/identity/application/ports/password-hasher.port'
import type { Password } from '@/modules/identity/domain/user/password'
import { parsePasswordHash } from '@/modules/identity/domain/user/password-hash'

const password = 'correct horse' as Password

/** What every `IPasswordHasher` adapter must do. */
export function describePasswordHasherContract(make: () => IPasswordHasher) {
  describe('IPasswordHasher contract', () => {
    it('makes a salted, algorithm-prefixed hash that never contains the password', async () => {
      const hasher = make()

      const [first, second] = [
        await hasher.hash(password),
        await hasher.hash(password),
      ]

      expect(parsePasswordHash(first).ok).toBe(true)
      expect(first).not.toContain(password)
      expect(first).not.toBe(second)
    })

    it('verifies the password it was made from, and nothing else', async () => {
      const hasher = make()
      const hash = await hasher.hash(password)

      expect(await hasher.verify(password, hash)).toBe(true)
      expect(await hasher.verify('correct horsE' as Password, hash)).toBe(false)
    })
  })
}
