import { describe } from 'vitest'

import { TaskRepository } from '@/modules/boards/infrastructure/task-repository'
import { MockTaskRepository } from '@/modules/boards/infrastructure/task-repository.mock'
import { resetMockStores } from '@/shared/infrastructure/mock-stores'
import { Outbox } from '@/shared/infrastructure/outbox/outbox'
import { MockOutbox } from '@/shared/infrastructure/outbox/outbox.mock'

import { describeTaskRepositoryContract } from '@tests/contracts/task-repository.contract'
import { givenMigratedDatabase } from '@tests/fixtures/database'

describe('TaskRepository (SQLite)', () => {
  describeTaskRepositoryContract(() => {
    const db = givenMigratedDatabase()
    const outbox = new Outbox(db, 'boards')
    return { repository: new TaskRepository(db, outbox), outbox }
  })
})

describe('MockTaskRepository', () => {
  describeTaskRepositoryContract(() => {
    resetMockStores()
    const outbox = new MockOutbox('boards')
    return { repository: new MockTaskRepository(outbox), outbox }
  })
})
