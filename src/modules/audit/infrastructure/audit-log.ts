import type { DatabaseSync } from 'node:sqlite'

import type {
  IAuditLog,
  Receipt,
} from '@/modules/audit/application/ports/audit-log.port'
import type { AuditEntry } from '@/modules/audit/domain/audit-entry/audit-entry'
import type { Name } from '@/modules/audit/domain/name/name'
import {
  ROLLBACK,
  transaction,
} from '@/shared/infrastructure/sqlite/transaction'

const PORT = 'IAuditLog'

/** `audit_entries` and `audit_names`, with inbox rows in `audit_inbox`. */
export class AuditLog implements IAuditLog {
  constructor(private readonly db: DatabaseSync) {}

  async record(
    entry: AuditEntry,
    names: readonly Name[],
    receipt: Receipt
  ): Promise<void> {
    transaction(this.db, PORT, () => {
      const { changes } = this.db
        .prepare(
          `INSERT INTO audit_inbox (event_id, handler, handled_at)
           VALUES (?, ?, ?) ON CONFLICT DO NOTHING`
        )
        .run(receipt.eventId, receipt.handler, new Date().toISOString())
      // Already applied: a redelivery.
      if (changes === 0) return ROLLBACK
      this.db
        .prepare(
          `INSERT INTO audit_entries (id, occurred_at, actor_id, subject,
             subject_id, board_id, task_id, action, details, causation_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT (id) DO NOTHING`
        )
        .run(
          entry.id,
          entry.occurredAt.toISOString(),
          entry.actorId,
          entry.subject,
          entry.subjectId,
          entry.boardId,
          entry.taskId,
          entry.action,
          JSON.stringify(entry.details),
          entry.causationId
        )
      const upsertName = this.db.prepare(
        `INSERT INTO audit_names (kind, id, name, aggregate_version)
         VALUES (?, ?, ?, ?)
         ON CONFLICT (kind, id) DO UPDATE
         SET name = excluded.name,
             aggregate_version = excluded.aggregate_version
         WHERE excluded.aggregate_version > audit_names.aggregate_version`
      )
      for (const { kind, id, name, aggregateVersion } of names) {
        upsertName.run(kind, id, name, aggregateVersion)
      }
      return true
    })
  }
}
