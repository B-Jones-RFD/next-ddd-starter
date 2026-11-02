import type { DatabaseSync } from 'node:sqlite'

import type {
  BoardMemberDto,
  BoardSummaryDto,
} from '@/modules/boards/application/dto/board-summary.dto'
import type { BoardDto } from '@/modules/boards/application/dto/board.dto'
import type {
  AssigneeDto,
  TaskDto,
  TaskSummaryDto,
} from '@/modules/boards/application/dto/task.dto'
import type { TagDto } from '@/modules/boards/application/dto/tag.dto'
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

// A task's tags still on its board, by name ignoring case.
const TASK_TAGS = `
  SELECT tt.task_id, g.id, g.name, g.color
  FROM boards_task_tags tt
  JOIN boards_tasks t ON t.id = tt.task_id
  JOIN boards_tags g ON g.id = tt.tag_id AND g.board_id = t.board_id`
const BY_NAME = 'ORDER BY g.name COLLATE NOCASE, g.id'

type TaskTagRow = TagDto & { task_id: string }

// Owner first, then in the order they joined.
const MEMBERS_OF = `
  SELECT m.board_id, m.user_id, p.display_name, m.role
  FROM boards_members m
  LEFT JOIN boards_people p ON p.user_id = m.user_id
  WHERE m.board_id IN (SELECT value FROM json_each(?))
  ORDER BY m.board_id, m.role = 'owner' DESC, m.position`

// In the order they were assigned.
const ASSIGNEES_OF = `
  SELECT a.task_id, a.user_id, p.display_name
  FROM boards_task_assignees a
  LEFT JOIN boards_people p ON p.user_id = a.user_id
  WHERE a.task_id IN (SELECT value FROM json_each(?))
  ORDER BY a.task_id, a.position`

/**
 * Boards' read side over `boards_boards`, `boards_members`, `boards_people`,
 * `boards_lists`, `boards_tasks` and `boards_task_assignees`.
 */
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
    const lists = query(
      PORT,
      () =>
        this.db
          .prepare(
            `SELECT id, name FROM boards_lists
             WHERE board_id = ? AND archived = 0
             ORDER BY position, id`
          )
          .all(row.id) as { id: string; name: string }[]
    )
    const tasks = query(
      PORT,
      () =>
        this.db
          .prepare(
            `SELECT id, title, list_id FROM boards_tasks
             WHERE board_id = ? AND archived = 0
             ORDER BY position, id`
          )
          .all(row.id) as { id: string; title: string; list_id: string }[]
    )
    const tags = query(PORT, () =>
      this.tagsByTask(
        this.db
          .prepare(`${TASK_TAGS} WHERE t.board_id = ? ${BY_NAME}`)
          .all(row.id) as TaskTagRow[]
      )
    )
    const assignees = query(PORT, () =>
      this.assigneesOf(tasks.map((task) => task.id))
    )
    const byList = new Map<string, TaskSummaryDto[]>()
    for (const task of tasks) {
      const inList = byList.get(task.list_id) ?? []
      inList.push({
        id: task.id,
        title: task.title,
        tags: tags.get(task.id) ?? [],
        assignees: assignees.get(task.id) ?? [],
      })
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
                    b.name AS board_name, t.list_id, l.name AS list_name,
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
              list_id: string
              list_name: string
              role: string | null
            }
          | undefined
    )
    if (!row) return err(new NotFoundError('Task', taskId))
    if (!row.role) return err(new ForbiddenError())
    const tags = query(PORT, () =>
      this.tagsByTask(
        this.db
          .prepare(`${TASK_TAGS} WHERE tt.task_id = ? ${BY_NAME}`)
          .all(row.id) as TaskTagRow[]
      )
    )
    const assignees = query(PORT, () => this.assigneesOf([row.id]))
    return ok({
      id: row.id,
      title: row.title,
      description: row.description,
      archived: row.archived === 1,
      boardId: row.board_id,
      boardName: row.board_name,
      listId: row.list_id,
      listName: row.list_name,
      tags: tags.get(row.id) ?? [],
      assignees: assignees.get(row.id) ?? [],
    })
  }

  async tagsForMember(
    boardId: string,
    userId: UserId
  ): Promise<Result<TagDto[], NotFoundError | ForbiddenError>> {
    const found = query(PORT, () => {
      const board = this.db
        .prepare(
          `SELECT me.role FROM boards_boards b
           LEFT JOIN boards_members me ON me.board_id = b.id AND me.user_id = ?
           WHERE b.id = ?`
        )
        .get(userId, boardId) as { role: string | null } | undefined
      if (!board) return undefined
      if (!board.role) return 'forbidden'
      return this.db
        .prepare(
          `SELECT id, name, color FROM boards_tags g
           WHERE board_id = ? ${BY_NAME}`
        )
        .all(boardId) as TagDto[]
    })
    if (found === undefined) return err(new NotFoundError('Board', boardId))
    if (found === 'forbidden') return err(new ForbiddenError())
    return ok(found.map(({ id, name, color }) => ({ id, name, color })))
  }

  private tagsByTask(rows: readonly TaskTagRow[]): Map<string, TagDto[]> {
    const byTask = new Map<string, TagDto[]>()
    for (const { task_id, id, name, color } of rows) {
      byTask.set(task_id, [...(byTask.get(task_id) ?? []), { id, name, color }])
    }
    return byTask
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

  private assigneesOf(taskIds: string[]): Map<string, AssigneeDto[]> {
    const rows = this.db.prepare(ASSIGNEES_OF).all(JSON.stringify(taskIds)) as {
      task_id: string
      user_id: string
      display_name: string | null
    }[]
    const byTask = new Map<string, AssigneeDto[]>()
    for (const row of rows) {
      const list = byTask.get(row.task_id) ?? []
      list.push({ userId: row.user_id, displayName: row.display_name })
      byTask.set(row.task_id, list)
    }
    return byTask
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
