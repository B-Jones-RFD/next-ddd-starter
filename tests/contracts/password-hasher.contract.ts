import { describe, expect, it } from 'vitest'

import type { IPasswordHasher } from '@/modules/identity/application/ports/password-hasher.port'
import type { Password } from '@/modules/identity/domain/user/password'
import {
  parsePasswordHash,
  type PasswordHash,
} from '@/modules/identity/domain/user/password-hash'

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

    it('needs no rehash for a hash it just made', async () => {
      const hasher = make()

      expect(hasher.needsRehash(await hasher.hash(password))).toBe(false)
    })

    it('needs a rehash for a hash made by another algorithm', () => {
      const hasher = make()

      expect(hasher.needsRehash('bcrypt$10$c2FsdGhhc2g' as PasswordHash)).toBe(
        true
      )
    })
  })
}
