import type { DatabaseSync } from 'node:sqlite'

import type {
  BoardMemberDto,
  BoardSummaryDto,
} from '@/modules/boards/application/dto/board-summary.dto'
import type { BoardDto } from '@/modules/boards/application/dto/board.dto'
import type {
  TaskDto,
  TaskSummaryDto,
} from '@/modules/boards/application/dto/task.dto'
import type {
  IBoardReader,
  View,
} from '@/modules/boards/application/ports/board-reader.port'
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

function archivedFlag(view: View): 0 | 1 {
  return view === 'archived' ? 1 : 0
}

/**
 * Boards' read side over `boards_boards`, `boards_members`, `boards_people`,
 * `boards_lists` and `boards_tasks`.
 */
export class BoardReader implements IBoardReader {
  constructor(private readonly db: DatabaseSync) {}

  async listForMember(userId: UserId, view: View): Promise<BoardSummaryDto[]> {
    return query(PORT, () => {
      const boards = this.db
        .prepare(
          `SELECT b.id, b.name
           FROM boards_boards b
           JOIN boards_members me ON me.board_id = b.id AND me.user_id = ?
           WHERE b.archived = ?
           ORDER BY b.name, b.id`
        )
        .all(userId, archivedFlag(view)) as { id: string; name: string }[]
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
    userId: UserId,
    view: View
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
    const flag = archivedFlag(view)
    const tasks = query(
      PORT,
      () =>
        this.db
          .prepare(
            `SELECT id, title, list_id FROM boards_tasks
             WHERE board_id = ? AND archived = ?
             ORDER BY position, id`
          )
          .all(row.id, flag) as { id: string; title: string; list_id: string }[]
    )
    // The Archived view also shows an active list holding archived tasks.
    const lists = query(
      PORT,
      () =>
        this.db
          .prepare(
            `SELECT id, name, archived FROM boards_lists
             WHERE board_id = ? AND (archived = ?
               OR (? = 1 AND id IN (SELECT value FROM json_each(?))))
             ORDER BY position, id`
          )
          .all(
            row.id,
            flag,
            flag,
            JSON.stringify(tasks.map((task) => task.list_id))
          ) as { id: string; name: string; archived: number }[]
    )
    const byList = new Map<string, TaskSummaryDto[]>()
    for (const task of tasks) {
      const inList = byList.get(task.list_id) ?? []
      inList.push({ id: task.id, title: task.title })
      byList.set(task.list_id, inList)
    }
    return ok({
      id: row.id,
      name: row.name,
      archived: row.archived === 1,
      role: row.role,
      members: members.get(row.id) ?? [],
      lists: lists.map((list) => ({
        id: list.id,
        name: list.name,
        archived: list.archived === 1,
        tasks: byList.get(list.id) ?? [],
      })),
    })
  }

  async getTaskForMember(
    taskId: string,
    userId: UserId
  ): Promise<Result<TaskDto, NotFoundError | ForbiddenError>> {
    const row = query(
      PORT,
      () =>
        this.db
          .prepare(
            `SELECT t.id, t.title, t.description, t.archived, t.board_id,
                    b.name AS board_name, b.archived AS board_archived,
                    t.list_id, l.name AS list_name,
                    me.role
             FROM boards_tasks t
             JOIN boards_boards b ON b.id = t.board_id
             JOIN boards_lists l ON l.id = t.list_id
             LEFT JOIN boards_members me
               ON me.board_id = t.board_id AND me.user_id = ?
             WHERE t.id = ?`
          )
          .get(userId, taskId) as
          | {
              id: string
              title: string
              description: string
              archived: number
              board_id: string
              board_name: string
              board_archived: number
              list_id: string
              list_name: string
              role: string | null
            }
          | undefined
    )
    if (!row) return err(new NotFoundError('Task', taskId))
    if (!row.role) return err(new ForbiddenError())
    return ok({
      id: row.id,
      title: row.title,
      description: row.description,
      archived: row.archived === 1,
      boardId: row.board_id,
      boardName: row.board_name,
      boardArchived: row.board_archived === 1,
      listId: row.list_id,
      listName: row.list_name,
    })
  }

  async roleOf(
    boardId: string,
    userId: UserId
  ): Promise<'owner' | 'member' | null> {
    const row = query(
      PORT,
      () =>
        this.db
          .prepare(
            'SELECT role FROM boards_members WHERE board_id = ? AND user_id = ?'
          )
          .get(boardId, userId) as { role: 'owner' | 'member' } | undefined
    )
    return row?.role ?? null
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
