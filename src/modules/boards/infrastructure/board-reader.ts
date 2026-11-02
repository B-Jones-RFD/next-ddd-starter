import type { DatabaseSync } from 'node:sqlite'

import type {
  BoardMemberDto,
  BoardSummaryDto,
} from '@/modules/boards/application/dto/board-summary.dto'
import type { BoardDto } from '@/modules/boards/application/dto/board.dto'
import type { IBoardReader } from '@/modules/boards/application/ports/board-reader.port'
import { query } from '@/shared/infrastructure/sqlite/translate-error'
import { NotFoundError } from '@/shared/kernel/errors/app-error'
import { ForbiddenError } from '@/shared/kernel/errors/domain-error'
import { err, ok, type Result } from '@/shared/kernel/result'
import type { UserId } from '@/shared/kernel/user-id'

const PORT = 'IBoardReader'

type MemberRow = {
  board_id: string
  user_id: string
  display_name: string | null
  role: 'owner' | 'member'
}

// Owner first, then in the order they joined.
const MEMBERS_OF = `
  SELECT m.board_id, m.user_id, p.display_name, m.role
  FROM boards_members m
  LEFT JOIN boards_people p ON p.user_id = m.user_id
  WHERE m.board_id IN (SELECT value FROM json_each(?))
  ORDER BY m.board_id, m.role = 'owner' DESC, m.position`

/** Boards' read side over `boards_boards`, `boards_members` and `boards_people`. */
export class BoardReader implements IBoardReader {
  constructor(private readonly db: DatabaseSync) {}

  async listForMember(userId: UserId): Promise<BoardSummaryDto[]> {
    return query(PORT, () => {
      const boards = this.db
        .prepare(
          `SELECT b.id, b.name
           FROM boards_boards b
           JOIN boards_members me ON me.board_id = b.id AND me.user_id = ?
           ORDER BY b.name, b.id`
        )
        .all(userId) as { id: string; name: string }[]
      const members = this.membersOf(boards.map((board) => board.id))
      return boards.map((board) => ({
        id: board.id,
        name: board.name,
        members: members.get(board.id) ?? [],
      }))
    })
  }

  async getForMember(
    boardId: string,
    userId: UserId
  ): Promise<Result<BoardDto, NotFoundError | ForbiddenError>> {
    const row = query(
      PORT,
      () =>
        this.db
          .prepare(
            `SELECT b.id, b.name, b.archived, me.role
             FROM boards_boards b
             LEFT JOIN boards_members me ON me.board_id = b.id AND me.user_id = ?
             WHERE b.id = ?`
          )
          .get(userId, boardId) as
          | {
              id: string
              name: string
              archived: number
              role: 'owner' | 'member' | null
            }
          | undefined
    )
    if (!row) return err(new NotFoundError('Board', boardId))
    if (!row.role) return err(new ForbiddenError())
    const members = query(PORT, () => this.membersOf([row.id]))
    return ok({
      id: row.id,
      name: row.name,
      archived: row.archived === 1,
      role: row.role,
      members: members.get(row.id) ?? [],
    })
  }

  private membersOf(boardIds: string[]): Map<string, BoardMemberDto[]> {
    const rows = this.db
      .prepare(MEMBERS_OF)
      .all(JSON.stringify(boardIds)) as MemberRow[]
    const byBoard = new Map<string, BoardMemberDto[]>()
    for (const row of rows) {
      const list = byBoard.get(row.board_id) ?? []
      list.push({
        userId: row.user_id,
        displayName: row.display_name,
        role: row.role,
      })
      byBoard.set(row.board_id, list)
    }
    return byBoard
  }
}
