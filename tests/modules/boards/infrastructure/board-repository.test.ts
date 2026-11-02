import { describe } from 'vitest'

import { BoardRepository } from '@/modules/boards/infrastructure/board-repository'
import { MockBoardRepository } from '@/modules/boards/infrastructure/board-repository.mock'
import { resetMockStores } from '@/shared/infrastructure/mock-stores'
import { Outbox } from '@/shared/infrastructure/outbox/outbox'
import { MockOutbox } from '@/shared/infrastructure/outbox/outbox.mock'

import { describeBoardRepositoryContract } from '@tests/contracts/board-repository.contract'
import { givenMigratedDatabase } from '@tests/fixtures/database'

describe('BoardRepository (SQLite)', () => {
  describeBoardRepositoryContract(() => {
    const db = givenMigratedDatabase()
    const outbox = new Outbox(db, 'boards')
    return { repository: new BoardRepository(db, outbox), outbox }
  })
})

describe('MockBoardRepository', () => {
  describeBoardRepositoryContract(() => {
    resetMockStores()
    const outbox = new MockOutbox('boards')
    return { repository: new MockBoardRepository(outbox), outbox }
  })
})
