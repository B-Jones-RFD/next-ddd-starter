import { describe } from 'vitest'

import { SessionRepository } from '@/modules/identity/infrastructure/session-repository'
import { MockSessionRepository } from '@/modules/identity/infrastructure/session-repository.mock'
import { UserReader } from '@/modules/identity/infrastructure/user-reader'
import { MockUserReader } from '@/modules/identity/infrastructure/user-reader.mock'
import { UserRepository } from '@/modules/identity/infrastructure/user-repository'
import { MockUserRepository } from '@/modules/identity/infrastructure/user-repository.mock'
import { resetMockStores } from '@/shared/infrastructure/mock-stores'
import { Outbox } from '@/shared/infrastructure/outbox/outbox'
import { MockOutbox } from '@/shared/infrastructure/outbox/outbox.mock'

import { describeUserReaderContract } from '@tests/contracts/user-reader.contract'
import { givenMigratedDatabase } from '@tests/fixtures/database'

describe('UserReader (SQLite)', () => {
  describeUserReaderContract(() => {
    const db = givenMigratedDatabase()
    const outbox = new Outbox(db, 'identity')
    return {
      reader: new UserReader(db),
      users: new UserRepository(db, outbox),
      sessions: new SessionRepository(db, outbox),
    }
  })
})

describe('MockUserReader', () => {
  describeUserReaderContract(() => {
    resetMockStores()
    const outbox = new MockOutbox('identity')
    return {
      reader: new MockUserReader(),
      users: new MockUserRepository(outbox),
      sessions: new MockSessionRepository(outbox),
    }
  })
})
