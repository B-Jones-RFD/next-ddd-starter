import { describe } from 'vitest'

import { PeopleProjection } from '@/modules/boards/infrastructure/people-projection'
import { MockPeopleProjection } from '@/modules/boards/infrastructure/people-projection.mock'
import { resetMockStores } from '@/shared/infrastructure/mock-stores'

import { describePeopleProjectionContract } from '@tests/contracts/people-projection.contract'
import { givenMigratedDatabase } from '@tests/fixtures/database'

describe('PeopleProjection (SQLite)', () => {
  describePeopleProjectionContract(
    () => new PeopleProjection(givenMigratedDatabase())
  )
})

describe('MockPeopleProjection', () => {
  describePeopleProjectionContract(() => {
    resetMockStores()
    return new MockPeopleProjection()
  })
})
