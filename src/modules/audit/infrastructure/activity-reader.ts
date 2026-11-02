import type { DatabaseSync } from 'node:sqlite'

import type {
  AuditEntryDto,
  SubjectEntryDto,
} from '@/modules/audit/application/dto/activity.dto'
import type {
  EntryPage,
  IActivityReader,
} from '@/modules/audit/application/ports/activity-reader.port'
import type {
  AuditAction,
  Subject,
} from '@/modules/audit/domain/audit-entry/audit-entry'
import { query } from '@/shared/infrastructure/sqlite/translate-error'

const PORT = 'IActivityReader'

type Row = {
  id: string
  occurred_at: string
  actor_id: string
  action: string
  details: string
  causation_id: string | null
}

const COLUMNS = 'id, occurred_at, actor_id, action, details, causation_id'

function toDto(row: Row): AuditEntryDto {
  return {
    id: row.id,
    occurredAt: row.occurred_at,
    actorId: row.actor_id,
    action: row.action,
    details: JSON.parse(row.details) as unknown,
    causationId: row.causation_id,
  } as AuditEntryDto
}

/** `?, ?, ?` for `count` values. */
function placeholders(count: number): string {
  return Array.from({ length: count }, () => '?').join(', ')
}

/** Reads `audit_entries` and `audit_names` for views. */
export class ActivityReader implements IActivityReader {
  constructor(private readonly db: DatabaseSync) {}

  async boardOfTask(taskId: string): Promise<string | null> {
    const row = query(
      PORT,
      () =>
        this.db
          .prepare(
            'SELECT board_id FROM audit_entries WHERE task_id = ? LIMIT 1'
          )
          .get(taskId) as { board_id: string | null } | undefined
    )
    return row?.board_id ?? null
  }

  async forTask(
    taskId: string,
    page: {
      before: string | null
      limit: number
      excluding: readonly AuditAction[]
    }
  ): Promise<AuditEntryDto[]> {
    const rows = query(
      PORT,
      () =>
        this.db
          .prepare(
            `SELECT ${COLUMNS} FROM audit_entries
             WHERE task_id = ?
               AND (? IS NULL OR id < ?)
               AND action NOT IN (SELECT value FROM json_each(?))
             ORDER BY id DESC
             LIMIT ?`
          )
          .all(
            taskId,
            page.before,
            page.before,
            JSON.stringify(page.excluding),
            page.limit
          ) as Row[]
    )
    return rows.map(toDto)
  }

  async forBoard(boardId: string, page: EntryPage): Promise<SubjectEntryDto[]> {
    return this.page('board_id = ?', [boardId], page)
  }

  async forUser(userId: string, page: EntryPage): Promise<SubjectEntryDto[]> {
    return this.page("subject = 'user' AND subject_id = ?", [userId], page)
  }

  /** One keyset page of the entries matching `where`, newest first. */
  private page(
    where: string,
    params: readonly string[],
    page: EntryPage
  ): SubjectEntryDto[] {
    const rows = query(
      PORT,
      () =>
        this.db
          .prepare(
            `SELECT ${COLUMNS}, subject, subject_id FROM audit_entries
             WHERE ${where}
               AND (? IS NULL OR id < ?)
               AND action NOT IN (SELECT value FROM json_each(?))
             ORDER BY id DESC
             LIMIT ?`
          )
          .all(
            ...params,
            page.before,
            page.before,
            JSON.stringify(page.excluding),
            page.limit
          ) as (Row & { subject: Subject; subject_id: string })[]
    )
    return rows.map((row) => ({
      ...toDto(row),
      subject: row.subject,
      subjectId: row.subject_id,
    }))
  }

  async byIds(ids: readonly string[]): Promise<AuditEntryDto[]> {
    if (ids.length === 0) return []
    const rows = query(
      PORT,
      () =>
        this.db
          .prepare(
            `SELECT ${COLUMNS} FROM audit_entries
             WHERE id IN (${placeholders(ids.length)})`
          )
          .all(...ids) as Row[]
    )
    return rows.map(toDto)
  }

  async names(ids: readonly string[]): Promise<Record<string, string>> {
    if (ids.length === 0) return {}
    const rows = query(
      PORT,
      () =>
        this.db
          .prepare(
            `SELECT id, name FROM audit_names
             WHERE id IN (${placeholders(ids.length)})`
          )
          .all(...ids) as { id: string; name: string }[]
    )
    return Object.fromEntries(rows.map((row) => [row.id, row.name]))
  }
}
