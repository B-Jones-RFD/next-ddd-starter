import { describe } from 'vitest'

import { UserRepository } from '@/modules/identity/infrastructure/user-repository'
import { MockUserRepository } from '@/modules/identity/infrastructure/user-repository.mock'
import { resetMockStores } from '@/shared/infrastructure/mock-stores'
import { Outbox } from '@/shared/infrastructure/outbox/outbox'
import { MockOutbox } from '@/shared/infrastructure/outbox/outbox.mock'

import { describeUserRepositoryContract } from '@tests/contracts/user-repository.contract'
import { givenMigratedDatabase } from '@tests/fixtures/database'

describe('UserRepository (SQLite)', () => {
  describeUserRepositoryContract(() => {
    const db = givenMigratedDatabase()
    const outbox = new Outbox(db, 'identity')
    return { repository: new UserRepository(db, outbox), outbox }
  })
})

describe('MockUserRepository', () => {
  describeUserRepositoryContract(() => {
    resetMockStores()
    const outbox = new MockOutbox('identity')
    return { repository: new MockUserRepository(outbox), outbox }
  })
})
