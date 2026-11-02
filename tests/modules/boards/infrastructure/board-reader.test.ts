import { describe } from 'vitest'

import { BoardReader } from '@/modules/boards/infrastructure/board-reader'
import { MockBoardReader } from '@/modules/boards/infrastructure/board-reader.mock'
import { BoardRepository } from '@/modules/boards/infrastructure/board-repository'
import { MockBoardRepository } from '@/modules/boards/infrastructure/board-repository.mock'
import { ListRepository } from '@/modules/boards/infrastructure/list-repository'
import { MockListRepository } from '@/modules/boards/infrastructure/list-repository.mock'
import { PeopleProjection } from '@/modules/boards/infrastructure/people-projection'
import { MockPeopleProjection } from '@/modules/boards/infrastructure/people-projection.mock'
import { resetMockStores } from '@/shared/infrastructure/mock-stores'
import { Outbox } from '@/shared/infrastructure/outbox/outbox'
import { MockOutbox } from '@/shared/infrastructure/outbox/outbox.mock'

import { describeBoardReaderContract } from '@tests/contracts/board-reader.contract'
import { givenMigratedDatabase } from '@tests/fixtures/database'

describe('BoardReader (SQLite)', () => {
  describeBoardReaderContract(() => {
    const db = givenMigratedDatabase()
    return {
      reader: new BoardReader(db),
      boards: new BoardRepository(db, new Outbox(db, 'boards')),
      people: new PeopleProjection(db),
      lists: new ListRepository(db, new Outbox(db, 'boards')),
    }
  })
})

describe('MockBoardReader', () => {
  describeBoardReaderContract(() => {
    resetMockStores()
    return {
      reader: new MockBoardReader(),
      boards: new MockBoardRepository(new MockOutbox('boards')),
      people: new MockPeopleProjection(),
      lists: new MockListRepository(new MockOutbox('boards')),
    }
  })
})
