import { describe, expect, it } from 'vitest'

import type { PasswordHash } from '@/modules/identity/domain/user/password-hash'
import { PasswordHasher } from '@/modules/identity/infrastructure/password-hasher'
import { MockPasswordHasher } from '@/modules/identity/infrastructure/password-hasher.mock'

import { describePasswordHasherContract } from '@tests/contracts/password-hasher.contract'

describe('PasswordHasher (scrypt)', () => {
  describePasswordHasherContract(() => new PasswordHasher())

  it('needs a rehash for a scrypt hash with older, weaker parameters', () => {
    const older = 'scrypt$16384$8$1$c2FsdA$aGFzaA' as PasswordHash

    expect(new PasswordHasher().needsRehash(older)).toBe(true)
  })
})

describe('MockPasswordHasher', () => {
  describePasswordHasherContract(() => new MockPasswordHasher())
})
