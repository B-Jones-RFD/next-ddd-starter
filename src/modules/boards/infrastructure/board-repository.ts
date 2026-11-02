import type { DatabaseSync } from 'node:sqlite'

import { translateBoardEvents } from '@/modules/boards/application/contracts/translate'
import type { Board, Role } from '@/modules/boards/domain/board/board'
import type { BoardId } from '@/modules/boards/domain/board/board-id'
import type { BoardName } from '@/modules/boards/domain/board/board-name'
import type { IBoardRepository } from '@/modules/boards/domain/board/board-repository.port'
import type { BoardEvent } from '@/modules/boards/domain/board/board.events'
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
import { toUserId } from '@/shared/kernel/user-id'

const PORT = 'IBoardRepository'

type BoardRow = {
  id: string
  name: string
  archived: number
  created_at: string
  version: number
}

type MemberRow = { user_id: string; role: Role }

/** Boards in `boards_boards`, with their members in `boards_members`. */
export class BoardRepository implements IBoardRepository {
  constructor(
    private readonly db: DatabaseSync,
    private readonly outbox: IOutbox
  ) {}

  async findById(id: BoardId): Promise<Result<Board, NotFoundError>> {
    const found = query(PORT, () => {
      const board = this.db
        .prepare('SELECT * FROM boards_boards WHERE id = ?')
        .get(id) as BoardRow | undefined
      if (!board) return undefined
      const members = this.db
        .prepare(
          `SELECT user_id, role FROM boards_members
           WHERE board_id = ? ORDER BY position`
        )
        .all(id) as MemberRow[]
      return { board, members }
    })
    if (!found) return err(new NotFoundError('Board', id))
    const { board, members } = found
    return ok({
      id: board.id as BoardId,
      name: board.name as BoardName,
      members: members.map((m) => ({
        userId: toUserId(m.user_id),
        role: m.role,
      })),
      archived: board.archived === 1,
      createdAt: new Date(board.created_at),
      version: board.version,
    })
  }

  async save(
    board: Board,
    events: readonly BoardEvent[],
    origin: EventOrigin
  ): Promise<Result<Board, ConflictError>> {
    const version = board.version + 1
    const entries = outboxEntries({
      aggregateId: board.id,
      aggregateVersion: version,
      origin,
      domainEvents: events,
      integrationEvents: translateBoardEvents(events),
    })

    const written = transaction(this.db, PORT, () => {
      const { changes } =
        board.version === 0
          ? this.db
              .prepare(
                `INSERT INTO boards_boards
                   (id, name, archived, created_at, version)
                 VALUES (?, ?, ?, ?, 1)
                 ON CONFLICT DO NOTHING`
              )
              .run(
                board.id,
                board.name,
                board.archived ? 1 : 0,
                board.createdAt.toISOString()
              )
          : this.db
              .prepare(
                `UPDATE boards_boards
                 SET name = ?, archived = ?, version = version + 1
                 WHERE id = ? AND version = ?`
              )
              .run(board.name, board.archived ? 1 : 0, board.id, board.version)
      if (changes === 0) return ROLLBACK

      this.db
        .prepare('DELETE FROM boards_members WHERE board_id = ?')
        .run(board.id)
      const insertMember = this.db.prepare(
        `INSERT INTO boards_members (board_id, user_id, role, position)
         VALUES (?, ?, ?, ?)`
      )
      board.members.forEach((member, position) => {
        insertMember.run(board.id, member.userId, member.role, position)
      })
      this.outbox.append(entries)
      return true
    })

    if (written === ROLLBACK) return err(new ConflictError('Board', board.id))
    return ok({ ...board, version })
  }
}
