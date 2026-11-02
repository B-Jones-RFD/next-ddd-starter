import type { DatabaseSync } from 'node:sqlite'

import { translateListEvents } from '@/modules/boards/application/contracts/translate'
import type { BoardId } from '@/modules/boards/domain/board/board-id'
import type { List } from '@/modules/boards/domain/list/list'
import type { ListId } from '@/modules/boards/domain/list/list-id'
import type { ListName } from '@/modules/boards/domain/list/list-name'
import type { IListRepository } from '@/modules/boards/domain/list/list-repository.port'
import type { ListEvent } from '@/modules/boards/domain/list/list.events'
import { outboxEntries } from '@/shared/infrastructure/outbox/outbox-entries'
import {
  ROLLBACK,
  transaction,
} from '@/shared/infrastructure/sqlite/transaction'
import { query } from '@/shared/infrastructure/sqlite/translate-error'
import { ConflictError, NotFoundError } from '@/shared/kernel/errors/app-error'
import type { EventOrigin } from '@/shared/kernel/events'
import type { IOutbox } from '@/shared/kernel/ports/outbox.port'
import { err, ok, type Result } from '@/shared/kernel/result'

const PORT = 'IListRepository'

type ListRow = {
  id: string
  board_id: string
  name: string
  position: string
  archived: number
  created_at: string
  version: number
}

function toList(row: ListRow): List {
  return {
    id: row.id as ListId,
    boardId: row.board_id as BoardId,
    name: row.name as ListName,
    position: row.position,
    archived: row.archived === 1,
    createdAt: new Date(row.created_at),
    version: row.version,
  }
}

/** Lists in `boards_lists`, one row per list. */
export class ListRepository implements IListRepository {
  constructor(
    private readonly db: DatabaseSync,
    private readonly outbox: IOutbox
  ) {}

  async findById(id: ListId): Promise<Result<List, NotFoundError>> {
    const row = query(
      PORT,
      () =>
        this.db.prepare('SELECT * FROM boards_lists WHERE id = ?').get(id) as
          ListRow | undefined
    )
    return row ? ok(toList(row)) : err(new NotFoundError('List', id))
  }

  async findLastOnBoard(boardId: BoardId): Promise<List | null> {
    const row = query(
      PORT,
      () =>
        this.db
          .prepare(
            `SELECT * FROM boards_lists WHERE board_id = ?
             ORDER BY position DESC, id DESC LIMIT 1`
          )
          .get(boardId) as ListRow | undefined
    )
    return row ? toList(row) : null
  }

  async save(
    list: List,
    events: readonly ListEvent[],
    origin: EventOrigin
  ): Promise<Result<List, ConflictError>> {
    const version = list.version + 1
    const entries = outboxEntries({
      aggregateId: list.id,
      aggregateVersion: version,
      origin,
      domainEvents: events,
      integrationEvents: translateListEvents(events),
    })

    const written = transaction(this.db, PORT, () => {
      const { changes } =
        list.version === 0
          ? this.db
              .prepare(
                `INSERT INTO boards_lists
                   (id, board_id, name, position, archived, created_at, version)
                 VALUES (?, ?, ?, ?, ?, ?, 1)
                 ON CONFLICT DO NOTHING`
              )
              .run(
                list.id,
                list.boardId,
                list.name,
                list.position,
                list.archived ? 1 : 0,
                list.createdAt.toISOString()
              )
          : this.db
              .prepare(
                `UPDATE boards_lists
                 SET name = ?, position = ?, archived = ?, version = version + 1
                 WHERE id = ? AND version = ?`
              )
              .run(
                list.name,
                list.position,
                list.archived ? 1 : 0,
                list.id,
                list.version
              )
      if (changes === 0) return ROLLBACK
      this.outbox.append(entries)
      return true
    })

    if (written === ROLLBACK) return err(new ConflictError('List', list.id))
    return ok({ ...list, version })
  }
}
