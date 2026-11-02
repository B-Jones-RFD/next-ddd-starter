import type { EventEnvelope } from '@/shared/kernel/events'

/** `domain` rows reach only handlers in the same context (§6). */
export type OutboxScope = 'domain' | 'integration'

/** W3C trace context of the span that was active during `save`. */
export type TraceContext = {
  readonly traceparent: string
  readonly tracestate?: string
}

/** One row to append, inside the caller's `save` transaction. */
export type OutboxEntry = {
  readonly scope: OutboxScope
  readonly envelope: EventEnvelope
  readonly traceContext: TraceContext | null
}

/** A row that is neither delivered nor failed. */
export type PendingOutboxRow = OutboxEntry & {
  /** Delivery attempts so far. */
  readonly attempts: number
  /** When the row may be tried again after a retryable failure. */
  readonly nextAttemptAt: Date | null
  /** When the row first failed, while it is retrying. */
  readonly firstFailedAt: Date | null
}

export type OutboxBacklog = {
  /** Rows neither delivered nor failed, retrying ones included. */
  readonly pending: number
  /** `occurredAt` of the oldest pending row, or null when none are pending. */
  readonly oldestPendingAt: Date | null
  /** Rows marked failed, waiting for `outbox:replay`. */
  readonly failed: number
}

// #region port
/**
 * One context's outbox (§6). Repositories append to it inside their `save`
 * transaction, and the relay reads it in id order.
 */
export interface IOutbox {
  /** The owning module, such as `identity`. */
  readonly name: string
  /**
   * Appends rows. Synchronous, so it runs inside the caller's
   * `BEGIN IMMEDIATE … COMMIT` with no `await` in between.
   */
  append(entries: readonly OutboxEntry[]): void
  /** Up to `limit` pending rows, oldest first. */
  pending(limit: number): Promise<PendingOutboxRow[]>
  markDelivered(id: string): Promise<void>
  /** Records a retryable failure. The row waits until `nextAttemptAt`. */
  markRetrying(
    id: string,
    failure: { error: string; nextAttemptAt: Date; failedAt: Date }
  ): Promise<void>
  /** Records a failure that won't be retried until a replay. */
  markFailed(id: string, failure: { error: string }): Promise<void>
  /**
   * Makes every failed row pending again, due at once and keeping its place
   * and attempt count, for `npm run outbox:replay`. Returns how many.
   */
  replayFailed(): Promise<number>
  /** Feeds the backlog gauges. */
  backlog(): Promise<OutboxBacklog>
}
// #endregion port
