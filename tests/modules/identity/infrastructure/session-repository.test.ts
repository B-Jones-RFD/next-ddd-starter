import { describe } from 'vitest'

import { SessionRepository } from '@/modules/identity/infrastructure/session-repository'
import { MockSessionRepository } from '@/modules/identity/infrastructure/session-repository.mock'
import { resetMockStores } from '@/shared/infrastructure/mock-stores'
import { Outbox } from '@/shared/infrastructure/outbox/outbox'
import { MockOutbox } from '@/shared/infrastructure/outbox/outbox.mock'

import { describeSessionRepositoryContract } from '@tests/contracts/session-repository.contract'
import { givenMigratedDatabase } from '@tests/fixtures/database'

describe('SessionRepository (SQLite)', () => {
  describeSessionRepositoryContract(() => {
    const db = givenMigratedDatabase()
    const outbox = new Outbox(db, 'identity')
    return { repository: new SessionRepository(db, outbox), outbox }
  })
})

describe('MockSessionRepository', () => {
  describeSessionRepositoryContract(() => {
    resetMockStores()
    const outbox = new MockOutbox('identity')
    return { repository: new MockSessionRepository(outbox), outbox }
  })
})
