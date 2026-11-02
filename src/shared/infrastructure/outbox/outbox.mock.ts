import { mockStore } from '@/shared/infrastructure/mock-stores'
import { signalOutboxAppended } from '@/shared/infrastructure/outbox/outbox-signal'
import type {
  IOutbox,
  OutboxBacklog,
  OutboxEntry,
  PendingOutboxRow,
} from '@/shared/kernel/ports/outbox.port'

type MockRow = {
  entry: OutboxEntry
  status: 'pending' | 'delivered' | 'failed'
  attempts: number
  nextAttemptAt: Date | null
  firstFailedAt: Date | null
  lastError: string | null
}

/** In-memory twin of `Outbox`: rows in append order, same states. */
export class MockOutbox implements IOutbox {
  constructor(readonly name: string) {}

  private rows(): MockRow[] {
    return mockStore(`${this.name}.outbox`, () => [] as MockRow[])
  }

  private row(id: string): MockRow | undefined {
    return this.rows().find((row) => row.entry.envelope.id === id)
  }

  append(entries: readonly OutboxEntry[]): void {
    if (entries.length === 0) return
    for (const entry of entries) {
      this.rows().push({
        entry: structuredClone(entry),
        status: 'pending',
        attempts: 0,
        nextAttemptAt: null,
        firstFailedAt: null,
        lastError: null,
      })
    }
    signalOutboxAppended()
  }

  async pending(limit: number): Promise<PendingOutboxRow[]> {
    return this.rows()
      .filter((row) => row.status === 'pending')
      .slice(0, limit)
      .map((row) => ({
        ...structuredClone(row.entry),
        attempts: row.attempts,
        nextAttemptAt: row.nextAttemptAt,
        firstFailedAt: row.firstFailedAt,
      }))
  }

  async markDelivered(id: string): Promise<void> {
    const row = this.row(id)
    if (!row) return
    row.status = 'delivered'
    row.attempts += 1
    row.nextAttemptAt = null
  }

  async markRetrying(
    id: string,
    failure: { error: string; nextAttemptAt: Date; failedAt: Date }
  ): Promise<void> {
    const row = this.row(id)
    if (!row) return
    row.attempts += 1
    row.lastError = failure.error
    row.nextAttemptAt = failure.nextAttemptAt
    row.firstFailedAt ??= failure.failedAt
  }

  async markFailed(id: string, failure: { error: string }): Promise<void> {
    const row = this.row(id)
    if (!row) return
    row.status = 'failed'
    row.attempts += 1
    row.lastError = failure.error
  }

  async backlog(): Promise<OutboxBacklog> {
    const rows = this.rows()
    const pending = rows.filter((row) => row.status === 'pending')
    const oldest = pending
      .map((row) => row.entry.envelope.occurredAt)
      .sort()
      .at(0)
    return {
      pending: pending.length,
      oldestPendingAt: oldest ? new Date(oldest) : null,
      failed: rows.filter((row) => row.status === 'failed').length,
    }
  }
}
