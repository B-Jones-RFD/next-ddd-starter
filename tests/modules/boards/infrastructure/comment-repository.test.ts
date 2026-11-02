import { describe } from 'vitest'

import { CommentRepository } from '@/modules/boards/infrastructure/comment-repository'
import { MockCommentRepository } from '@/modules/boards/infrastructure/comment-repository.mock'
import { resetMockStores } from '@/shared/infrastructure/mock-stores'
import { Outbox } from '@/shared/infrastructure/outbox/outbox'
import { MockOutbox } from '@/shared/infrastructure/outbox/outbox.mock'

import { describeCommentRepositoryContract } from '@tests/contracts/comment-repository.contract'
import { givenMigratedDatabase } from '@tests/fixtures/database'

describe('CommentRepository (SQLite)', () => {
  describeCommentRepositoryContract(() => {
    const db = givenMigratedDatabase()
    const outbox = new Outbox(db, 'boards')
    return { repository: new CommentRepository(db, outbox), outbox }
  })
})

describe('MockCommentRepository', () => {
  describeCommentRepositoryContract(() => {
    resetMockStores()
    const outbox = new MockOutbox('boards')
    return { repository: new MockCommentRepository(outbox), outbox }
  })
})
