import { describe } from 'vitest'

import { PasswordHasher } from '@/modules/identity/infrastructure/password-hasher'
import { MockPasswordHasher } from '@/modules/identity/infrastructure/password-hasher.mock'

import { describePasswordHasherContract } from '@tests/contracts/password-hasher.contract'

describe('PasswordHasher (scrypt)', () => {
  describePasswordHasherContract(() => new PasswordHasher())
})

describe('MockPasswordHasher', () => {
  describePasswordHasherContract(() => new MockPasswordHasher())
})
