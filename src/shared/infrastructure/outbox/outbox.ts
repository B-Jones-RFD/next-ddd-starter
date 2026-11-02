import type { DatabaseSync } from 'node:sqlite'

import { signalOutboxAppended } from '@/shared/infrastructure/outbox/outbox-signal'
import { query } from '@/shared/infrastructure/sqlite/translate-error'
import type { EventEnvelope } from '@/shared/kernel/events'
import type {
  IOutbox,
  OutboxBacklog,
  OutboxEntry,
  OutboxScope,
  PendingOutboxRow,
} from '@/shared/kernel/ports/outbox.port'
import { toUserId } from '@/shared/kernel/user-id'

const PORT = 'IOutbox'

type Row = {
  id: string
  scope: OutboxScope
  type: string
  version: number
  occurred_at: string
  aggregate_id: string
  aggregate_version: number
  actor_id: string
  causation_id: string | null
  payload: string
  trace_context: string | null
  attempts: number
  next_attempt_at: string | null
  first_failed_at: string | null
}

function toPendingRow(row: Row): PendingOutboxRow {
  const envelope: EventEnvelope = {
    id: row.id,
    type: row.type,
    version: row.version,
    occurredAt: row.occurred_at,
    aggregateId: row.aggregate_id,
    aggregateVersion: row.aggregate_version,
    actorId: toUserId(row.actor_id),
    causationId: row.causation_id,
    payload: JSON.parse(row.payload) as unknown,
  }
  return {
    scope: row.scope,
    envelope,
    traceContext: row.trace_context
      ? (JSON.parse(row.trace_context) as PendingOutboxRow['traceContext'])
      : null,
    attempts: row.attempts,
    nextAttemptAt: row.next_attempt_at ? new Date(row.next_attempt_at) : null,
    firstFailedAt: row.first_failed_at ? new Date(row.first_failed_at) : null,
  }
}

/** A context's outbox table, `<name>_outbox`, on the shared connection. */
export class Outbox implements IOutbox {
  private readonly table: string

  constructor(
    private readonly db: DatabaseSync,
    readonly name: string
  ) {
    if (!/^[a-z]+$/.test(name)) throw new Error(`Bad outbox name: ${name}`)
    this.table = `${name}_outbox`
  }

  append(entries: readonly OutboxEntry[]): void {
    if (entries.length === 0) return
    query(PORT, () => {
      const insert = this.db.prepare(
        `INSERT INTO ${this.table} (id, scope, type, version, occurred_at,
           aggregate_id, aggregate_version, actor_id, causation_id, payload,
           trace_context)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      for (const { scope, envelope, traceContext } of entries) {
        insert.run(
          envelope.id,
          scope,
          envelope.type,
          envelope.version,
          envelope.occurredAt,
          envelope.aggregateId,
          envelope.aggregateVersion,
          envelope.actorId,
          envelope.causationId,
          JSON.stringify(envelope.payload),
          traceContext ? JSON.stringify(traceContext) : null
        )
      }
    })
    signalOutboxAppended()
  }

  async pending(limit: number): Promise<PendingOutboxRow[]> {
    const rows = query(
      PORT,
      () =>
        this.db
          .prepare(
            `SELECT * FROM ${this.table} WHERE status = 'pending'
             ORDER BY seq LIMIT ?`
          )
          .all(limit) as Row[]
    )
    return rows.map(toPendingRow)
  }

  async markDelivered(id: string): Promise<void> {
    query(PORT, () =>
      this.db
        .prepare(
          `UPDATE ${this.table}
           SET status = 'delivered', attempts = attempts + 1,
               delivered_at = ?, next_attempt_at = NULL
           WHERE id = ?`
        )
        .run(new Date().toISOString(), id)
    )
  }

  async markRetrying(
    id: string,
    failure: { error: string; nextAttemptAt: Date; failedAt: Date }
  ): Promise<void> {
    query(PORT, () =>
      this.db
        .prepare(
          `UPDATE ${this.table}
           SET attempts = attempts + 1, last_error = ?, next_attempt_at = ?,
               first_failed_at = COALESCE(first_failed_at, ?)
           WHERE id = ?`
        )
        .run(
          failure.error,
          failure.nextAttemptAt.toISOString(),
          failure.failedAt.toISOString(),
          id
        )
    )
  }

  async markFailed(id: string, failure: { error: string }): Promise<void> {
    query(PORT, () =>
      this.db
        .prepare(
          `UPDATE ${this.table}
           SET status = 'failed', attempts = attempts + 1, last_error = ?
           WHERE id = ?`
        )
        .run(failure.error, id)
    )
  }

  async backlog(): Promise<OutboxBacklog> {
    const row = query(
      PORT,
      () =>
        this.db
          .prepare(
            `SELECT
               COUNT(*) FILTER (WHERE status = 'pending') AS pending,
               MIN(occurred_at) FILTER (WHERE status = 'pending') AS oldest,
               COUNT(*) FILTER (WHERE status = 'failed') AS failed
             FROM ${this.table}`
          )
          .get() as { pending: number; oldest: string | null; failed: number }
    )
    return {
      pending: row.pending,
      oldestPendingAt: row.oldest ? new Date(row.oldest) : null,
      failed: row.failed,
    }
  }
}
