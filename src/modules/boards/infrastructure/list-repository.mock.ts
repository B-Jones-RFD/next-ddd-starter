import { translateListEvents } from '@/modules/boards/application/contracts/translate'
import type { BoardId } from '@/modules/boards/domain/board/board-id'
import type { List } from '@/modules/boards/domain/list/list'
import type { ListId } from '@/modules/boards/domain/list/list-id'
import type { IListRepository } from '@/modules/boards/domain/list/list-repository.port'
import type { ListEvent } from '@/modules/boards/domain/list/list.events'
import { mockStore } from '@/shared/infrastructure/mock-stores'
import { outboxEntries } from '@/shared/infrastructure/outbox/outbox-entries'
import { ConflictError, NotFoundError } from '@/shared/kernel/errors/app-error'
import type { EventOrigin } from '@/shared/kernel/events'
import type { IOutbox } from '@/shared/kernel/ports/outbox.port'
import { err, ok, type Result } from '@/shared/kernel/result'

/** The mock lists store, shared with `MockBoardReader`. */
export function mockLists(): Map<string, List> {
  return mockStore('boards.lists', () => new Map<string, List>())
}

/** Lists in board order: by `(position, id)`, as SQLite's BINARY collation sorts. */
export const byPositionThenId = (a: List, b: List) =>
  a.position < b.position
    ? -1
    : a.position > b.position
      ? 1
      : a.id < b.id
        ? -1
        : a.id > b.id
          ? 1
          : 0

/** In-memory twin of `ListRepository`: same version rules and order. */
export class MockListRepository implements IListRepository {
  constructor(private readonly outbox: IOutbox) {}

  async findById(id: ListId): Promise<Result<List, NotFoundError>> {
    const list = mockLists().get(id)
    return list ? ok(structuredClone(list)) : err(new NotFoundError('List', id))
  }

  async findLastOnBoard(boardId: BoardId): Promise<List | null> {
    const last = [...mockLists().values()]
      .filter((list) => list.boardId === boardId)
      .sort(byPositionThenId)
      .at(-1)
    return last ? structuredClone(last) : null
  }

  async save(
    list: List,
    events: readonly ListEvent[],
    origin: EventOrigin
  ): Promise<Result<List, ConflictError>> {
    const lists = mockLists()
    const stored = lists.get(list.id)
    const fresh =
      list.version === 0 ? !stored : stored?.version === list.version
    if (!fresh) return err(new ConflictError('List', list.id))

    const saved = { ...list, version: list.version + 1 }
    lists.set(list.id, structuredClone(saved))
    this.outbox.append(
      outboxEntries({
        aggregateId: list.id,
        aggregateVersion: saved.version,
        origin,
        domainEvents: events,
        integrationEvents: translateListEvents(events),
      })
    )
    return ok(saved)
  }
}
