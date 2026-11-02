import type { DatabaseSync } from 'node:sqlite'

import { translateTaskEvents } from '@/modules/boards/application/contracts/translate'
import type { BoardId } from '@/modules/boards/domain/board/board-id'
import { toTagId, type TagId } from '@/modules/boards/domain/board/tag'
import type { ListId } from '@/modules/boards/domain/list/list-id'
import type { Task } from '@/modules/boards/domain/task/task'
import type { TaskDescription } from '@/modules/boards/domain/task/task-description'
import type { TaskId } from '@/modules/boards/domain/task/task-id'
import type { TaskTitle } from '@/modules/boards/domain/task/task-title'
import type { ITaskRepository } from '@/modules/boards/domain/task/task-repository.port'
import type { TaskEvent } from '@/modules/boards/domain/task/task.events'
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

const PORT = 'ITaskRepository'

type TaskRow = {
  id: string
  board_id: string
  list_id: string
  title: string
  description: string
  position: string
  archived: number
  created_at: string
  version: number
}

function toTask(row: TaskRow, tagIds: readonly TagId[]): Task {
  return {
    id: row.id as TaskId,
    boardId: row.board_id as BoardId,
    listId: row.list_id as ListId,
    title: row.title as TaskTitle,
    description: row.description as TaskDescription,
    tagIds,
    position: row.position,
    archived: row.archived === 1,
    createdAt: new Date(row.created_at),
    version: row.version,
  }
}

/**
 * Tasks in `boards_tasks`, one row per task, with their tags in
 * `boards_task_tags`.
 */
export class TaskRepository implements ITaskRepository {
  constructor(
    private readonly db: DatabaseSync,
    private readonly outbox: IOutbox
  ) {}

  /** The rows as tasks, each with its tag ids in the order attached. */
  private withTags(rows: readonly TaskRow[]): Task[] {
    if (rows.length === 0) return []
    const tagRows = this.db
      .prepare(
        `SELECT task_id, tag_id FROM boards_task_tags
         WHERE task_id IN (SELECT value FROM json_each(?))
         ORDER BY task_id, position`
      )
      .all(JSON.stringify(rows.map((row) => row.id))) as {
      task_id: string
      tag_id: string
    }[]
    const byTask = new Map<string, TagId[]>()
    for (const { task_id, tag_id } of tagRows) {
      byTask.set(task_id, [...(byTask.get(task_id) ?? []), toTagId(tag_id)])
    }
    return rows.map((row) => toTask(row, byTask.get(row.id) ?? []))
  }

  async findById(id: TaskId): Promise<Result<Task, NotFoundError>> {
    const [task] = query(PORT, () => {
      const row = this.db
        .prepare('SELECT * FROM boards_tasks WHERE id = ?')
        .get(id) as TaskRow | undefined
      return this.withTags(row ? [row] : [])
    })
    return task ? ok(task) : err(new NotFoundError('Task', id))
  }

  async findLastInList(listId: ListId): Promise<Task | null> {
    const [task] = query(PORT, () => {
      const row = this.db
        .prepare(
          `SELECT * FROM boards_tasks WHERE list_id = ?
           ORDER BY position DESC, id DESC LIMIT 1`
        )
        .get(listId) as TaskRow | undefined
      return this.withTags(row ? [row] : [])
    })
    return task ?? null
  }

  async findTaggedWith(tagId: TagId): Promise<Task[]> {
    return query(PORT, () =>
      this.withTags(
        this.db
          .prepare(
            `SELECT t.* FROM boards_tasks t
             JOIN boards_task_tags tt ON tt.task_id = t.id
             WHERE tt.tag_id = ?
             ORDER BY t.id`
          )
          .all(tagId) as TaskRow[]
      )
    )
  }

  async save(
    task: Task,
    events: readonly TaskEvent[],
    origin: EventOrigin
  ): Promise<Result<Task, ConflictError>> {
    const version = task.version + 1
    const entries = outboxEntries({
      aggregateId: task.id,
      aggregateVersion: version,
      origin,
      domainEvents: events,
      integrationEvents: translateTaskEvents(events),
    })

    const written = transaction(this.db, PORT, () => {
      const { changes } =
        task.version === 0
          ? this.db
              .prepare(
                `INSERT INTO boards_tasks
                   (id, board_id, list_id, title, description, position,
                    archived, created_at, version)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
                 ON CONFLICT DO NOTHING`
              )
              .run(
                task.id,
                task.boardId,
                task.listId,
                task.title,
                task.description,
                task.position,
                task.archived ? 1 : 0,
                task.createdAt.toISOString()
              )
          : this.db
              .prepare(
                `UPDATE boards_tasks
                 SET list_id = ?, title = ?, description = ?, position = ?,
                     archived = ?, version = version + 1
                 WHERE id = ? AND version = ?`
              )
              .run(
                task.listId,
                task.title,
                task.description,
                task.position,
                task.archived ? 1 : 0,
                task.id,
                task.version
              )
      if (changes === 0) return ROLLBACK
      this.db
        .prepare('DELETE FROM boards_task_tags WHERE task_id = ?')
        .run(task.id)
      const insertTag = this.db.prepare(
        `INSERT INTO boards_task_tags (task_id, tag_id, position)
         VALUES (?, ?, ?)`
      )
      task.tagIds.forEach((tagId, position) => {
        insertTag.run(task.id, tagId, position)
      })
      this.outbox.append(entries)
      return true
    })

    if (written === ROLLBACK) return err(new ConflictError('Task', task.id))
    return ok({ ...task, version })
  }
}
