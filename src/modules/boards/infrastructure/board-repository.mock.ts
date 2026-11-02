import { translateBoardEvents } from '@/modules/boards/application/contracts/translate'
import type { Board } from '@/modules/boards/domain/board/board'
import type { BoardId } from '@/modules/boards/domain/board/board-id'
import type { IBoardRepository } from '@/modules/boards/domain/board/board-repository.port'
import type { BoardEvent } from '@/modules/boards/domain/board/board.events'
import { mockStore } from '@/shared/infrastructure/mock-stores'
import { outboxEntries } from '@/shared/infrastructure/outbox/outbox-entries'
import { ConflictError, NotFoundError } from '@/shared/kernel/errors/app-error'
import type { EventOrigin } from '@/shared/kernel/events'
import type { IOutbox } from '@/shared/kernel/ports/outbox.port'
import { err, ok, type Result } from '@/shared/kernel/result'

/** The mock boards store, shared with `MockBoardReader`. */
export function mockBoards(): Map<string, Board> {
  return mockStore('boards.boards', () => new Map<string, Board>())
}

/** In-memory twin of `BoardRepository`: same version rules. */
export class MockBoardRepository implements IBoardRepository {
  constructor(private readonly outbox: IOutbox) {}

  async findById(id: BoardId): Promise<Result<Board, NotFoundError>> {
    const board = mockBoards().get(id)
    return board
      ? ok(structuredClone(board))
      : err(new NotFoundError('Board', id))
  }

  async save(
    board: Board,
    events: readonly BoardEvent[],
    origin: EventOrigin
  ): Promise<Result<Board, ConflictError>> {
    const boards = mockBoards()
    const stored = boards.get(board.id)
    const fresh =
      board.version === 0 ? !stored : stored?.version === board.version
    if (!fresh) return err(new ConflictError('Board', board.id))

    const saved = { ...board, version: board.version + 1 }
    boards.set(board.id, structuredClone(saved))
    this.outbox.append(
      outboxEntries({
        aggregateId: board.id,
        aggregateVersion: saved.version,
        origin,
        domainEvents: events,
        integrationEvents: translateBoardEvents(events),
      })
    )
    return ok(saved)
  }
}
