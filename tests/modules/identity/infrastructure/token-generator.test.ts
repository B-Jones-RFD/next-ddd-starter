import { describe } from 'vitest'

import { TokenGenerator } from '@/modules/identity/infrastructure/token-generator'
import { MockTokenGenerator } from '@/modules/identity/infrastructure/token-generator.mock'
import { resetMockStores } from '@/shared/infrastructure/mock-stores'

import { describeTokenGeneratorContract } from '@tests/contracts/token-generator.contract'

describe('TokenGenerator', () => {
  describeTokenGeneratorContract(() => new TokenGenerator())
})

describe('MockTokenGenerator', () => {
  describeTokenGeneratorContract(() => {
    resetMockStores()
    return new MockTokenGenerator()
  })
})
