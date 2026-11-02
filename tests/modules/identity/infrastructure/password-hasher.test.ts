import { describe, expect, it } from 'vitest'

import type { PasswordHash } from '@/modules/identity/domain/user/password-hash'
import { PasswordHasher } from '@/modules/identity/infrastructure/password-hasher'
import { MockPasswordHasher } from '@/modules/identity/infrastructure/password-hasher.mock'

import { describePasswordHasherContract } from '@tests/contracts/password-hasher.contract'

describe('PasswordHasher (scrypt)', () => {
  describePasswordHasherContract({
    make: () => new PasswordHasher(),
    older: () => new PasswordHasher({ N: 2 ** 14, r: 8, p: 1 }),
    stronger: () => new PasswordHasher({ N: 2 ** 17, r: 8, p: 2 }),
  })

  it('needs a rehash when any one parameter is weaker, even if another is stronger', () => {
    const mixed = 'scrypt$262144$4$1$c2FsdA$aGFzaA' as PasswordHash

    expect(new PasswordHasher().needsRehash(mixed)).toBe(true)
  })
})

describe('MockPasswordHasher', () => {
  describePasswordHasherContract({
    make: () => new MockPasswordHasher(),
    older: () => new MockPasswordHasher(1),
    stronger: () => new MockPasswordHasher(3),
  })
})
