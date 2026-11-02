import { describe } from 'vitest'

import { resetMockStores } from '@/shared/infrastructure/mock-stores'
import { Outbox } from '@/shared/infrastructure/outbox/outbox'
import { MockOutbox } from '@/shared/infrastructure/outbox/outbox.mock'

import { describeOutboxContract } from '@tests/contracts/outbox.contract'
import { givenMigratedDatabase } from '@tests/fixtures/database'

describe('Outbox (SQLite)', () => {
  describeOutboxContract(() => new Outbox(givenMigratedDatabase(), 'identity'))
})

describe('MockOutbox', () => {
  describeOutboxContract(() => {
    resetMockStores()
    return new MockOutbox('identity')
  })
})
