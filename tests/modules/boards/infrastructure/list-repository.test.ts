import { describe } from 'vitest'

import { ListRepository } from '@/modules/boards/infrastructure/list-repository'
import { MockListRepository } from '@/modules/boards/infrastructure/list-repository.mock'
import { resetMockStores } from '@/shared/infrastructure/mock-stores'
import { Outbox } from '@/shared/infrastructure/outbox/outbox'
import { MockOutbox } from '@/shared/infrastructure/outbox/outbox.mock'

import { describeListRepositoryContract } from '@tests/contracts/list-repository.contract'
import { givenMigratedDatabase } from '@tests/fixtures/database'

describe('ListRepository (SQLite)', () => {
  describeListRepositoryContract(() => {
    const db = givenMigratedDatabase()
    const outbox = new Outbox(db, 'boards')
    return { repository: new ListRepository(db, outbox), outbox }
  })
})

describe('MockListRepository', () => {
  describeListRepositoryContract(() => {
    resetMockStores()
    const outbox = new MockOutbox('boards')
    return { repository: new MockListRepository(outbox), outbox }
  })
})
