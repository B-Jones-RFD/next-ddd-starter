import { SpanKind, trace } from '@opentelemetry/api'

import { logger } from '@/shared/infrastructure/logging'
import { getMeter } from '@/shared/infrastructure/metrics'
import { registerOutboxGauges } from '@/shared/infrastructure/metrics/outbox-gauges'
import { onOutboxAppended } from '@/shared/infrastructure/outbox/outbox-signal'
import {
  APP_EVENT_AGGREGATE_ID,
  APP_EVENT_CAUSATION_ID,
  APP_EVENT_ID,
  APP_EVENT_TYPE,
  APP_MODULE,
  APP_OUTBOX_ATTEMPT,
  APP_OUTBOX_NAME,
  APP_OUTBOX_ROWS,
  APP_OUTBOX_SCOPE,
} from '@/shared/infrastructure/tracing/attributes'
import {
  recordThrownError,
  setAppAttributes,
} from '@/shared/infrastructure/tracing/span-data'
import { linkTo } from '@/shared/infrastructure/tracing/trace-context'
import { AppError } from '@/shared/kernel/errors/app-error'
import { InfrastructureError } from '@/shared/kernel/errors/infrastructure-error'
import type {
  EventHandler,
  IEventRelay,
} from '@/shared/kernel/ports/event-relay.port'
import type {
  IOutbox,
  PendingOutboxRow,
} from '@/shared/kernel/ports/outbox.port'

// #region handler-name
/** `<module>.<camelCaseName>`, as ADR 0016 requires of handler names. */
const HANDLER_NAME = /^[a-z]+\.[a-z][A-Za-z0-9]*$/
// #endregion handler-name

const BATCH = 100
const POLL_INTERVAL_MS = 1_000
const MAX_BACKOFF_MS = 60_000
/** An alerting judgement, not a deployment fact (ADR 0015). */
const STUCK_AFTER_MS = 5 * 60_000

type Outcome = 'delivered' | 'retrying' | 'failed'

const tracer = trace.getTracer('next-ddd-starter')

function backoffMs(attempts: number): number {
  return Math.min(MAX_BACKOFF_MS, 1_000 * 2 ** Math.max(0, attempts - 1))
}

function describeError(error: unknown): string {
  const text =
    error instanceof AppError
      ? `${error.code}: ${error.message}`
      : error instanceof Error
        ? `${error.name}: ${error.message}`
        : typeof error
  return text.slice(0, 500)
}

function isDue(row: PendingOutboxRow, now: number): boolean {
  return row.nextAttemptAt === null || row.nextAttemptAt.getTime() <= now
}

/**
 * The in-process relay (§6). It delivers each outbox in id order and marks a
 * row delivered only when every handler has succeeded. A retryable outage
 * retries with backoff while its stream waits. Anything else marks the row
 * failed and moves on. One drain runs at a time.
 */
export class EventRelay implements IEventRelay {
  private readonly outboxes: readonly IOutbox[]
  private readonly handlers: readonly EventHandler[]
  private tail: Promise<void> = Promise.resolve()
  private queued: Promise<void> | null = null
  private timer: ReturnType<typeof setInterval> | null = null
  private unsubscribe: (() => void) | null = null
  private readonly stuck = new Set<string>()

  constructor(options: {
    outboxes: readonly IOutbox[]
    handlers: readonly EventHandler[]
  }) {
    for (const handler of options.handlers) {
      if (!HANDLER_NAME.test(handler.name)) {
        throw new Error(
          `Handler name "${handler.name}" must be <module>.<camelCaseName>.`
        )
      }
    }
    this.outboxes = options.outboxes
    this.handlers = options.handlers
  }

  start(): void {
    if (this.timer) return
    registerOutboxGauges(getMeter(), this.outboxes)
    this.unsubscribe = onOutboxAppended(() => this.kick())
    this.timer = setInterval(() => this.kick(), POLL_INTERVAL_MS)
    this.timer.unref()
    this.kick()
  }

  async stop(): Promise<void> {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
    this.unsubscribe?.()
    this.unsubscribe = null
    await this.tail
  }

  kick(): void {
    // A failed read of the outbox is retried on the next poll.
    this.drain().catch(() => {})
  }

  drain(): Promise<void> {
    // A drain that hasn't started yet will see every row appended so far.
    if (this.queued) return this.queued
    const run = this.tail.then(async () => {
      this.queued = null
      while ((await this.cycle()) > 0) {
        // Keep going until nothing is due.
      }
    })
    this.queued = run
    this.tail = run.catch(() => {})
    return run
  }

  /** One pass over every outbox. Returns how many rows it processed. */
  private async cycle(): Promise<number> {
    const now = Date.now()
    const batches: { outbox: IOutbox; rows: PendingOutboxRow[] }[] = []
    let claimed = 0
    for (const outbox of this.outboxes) {
      const pending = await outbox.pending(BATCH)
      const firstWaiting = pending.findIndex((row) => !isDue(row, now))
      const rows =
        firstWaiting === -1 ? pending : pending.slice(0, firstWaiting)
      if (rows.length > 0) batches.push({ outbox, rows })
      claimed += rows.length
    }
    // An idle poll starts no span (ADR 0016).
    if (claimed === 0) return 0

    return tracer.startActiveSpan(
      'outbox.drain',
      { kind: SpanKind.INTERNAL, root: true },
      async (span) => {
        setAppAttributes(span, { [APP_OUTBOX_ROWS]: claimed })
        try {
          // #region streams
          let processed = 0
          for (const { outbox, rows } of batches) {
            for (const row of rows) {
              processed += 1
              // A retrying row holds its stream until it is due again.
              if ((await this.deliver(outbox, row)) === 'retrying') break
            }
          }
          // #endregion streams
          return processed
        } finally {
          span.end()
        }
      }
    )
  }

  // #region handlers-for
  private handlersFor(outbox: IOutbox, row: PendingOutboxRow): EventHandler[] {
    return this.handlers.filter(
      (handler) =>
        handler.eventType === row.envelope.type &&
        handler.version === row.envelope.version &&
        (row.scope === 'integration' ||
          handler.name.startsWith(`${outbox.name}.`))
    )
  }
  // #endregion handlers-for

  private async deliver(
    outbox: IOutbox,
    row: PendingOutboxRow
  ): Promise<Outcome> {
    const { envelope } = row
    return tracer.startActiveSpan(
      `outbox.deliver ${envelope.type}`,
      { kind: SpanKind.CONSUMER, links: linkTo(row.traceContext) },
      async (span) => {
        setAppAttributes(span, {
          [APP_OUTBOX_NAME]: outbox.name,
          [APP_OUTBOX_SCOPE]: row.scope,
          [APP_OUTBOX_ATTEMPT]: row.attempts + 1,
          [APP_EVENT_ID]: envelope.id,
          [APP_EVENT_TYPE]: envelope.type,
          [APP_EVENT_AGGREGATE_ID]: envelope.aggregateId,
          ...(envelope.causationId
            ? { [APP_EVENT_CAUSATION_ID]: envelope.causationId }
            : {}),
        })
        const fields = {
          outbox: outbox.name,
          eventId: envelope.id,
          eventType: envelope.type,
        }
        try {
          for (const handler of this.handlersFor(outbox, row)) {
            await this.handle(handler, row)
          }
        } catch (error) {
          recordThrownError(span, error)
          span.end()
          return this.recordFailure(outbox, row, error, fields)
        }

        await outbox.markDelivered(envelope.id)
        if (row.firstFailedAt) {
          this.stuck.delete(envelope.id)
          logger.info('outbox.row.recovered', {
            ...fields,
            attempts: row.attempts + 1,
            durationMs: Date.now() - row.firstFailedAt.getTime(),
          })
        } else {
          logger.debug('outbox.row.delivered', fields)
        }
        span.end()
        return 'delivered'
      }
    )
  }

  private async handle(
    handler: EventHandler,
    row: PendingOutboxRow
  ): Promise<void> {
    await tracer.startActiveSpan(
      `outbox.handle ${handler.name}`,
      { kind: SpanKind.INTERNAL },
      async (span) => {
        setAppAttributes(span, {
          [APP_MODULE]: handler.name.slice(0, handler.name.indexOf('.')),
        })
        try {
          await handler.handle(row.envelope)
        } catch (error) {
          recordThrownError(span, error)
          throw error
        } finally {
          span.end()
        }
      }
    )
  }

  // #region record-failure
  private async recordFailure(
    outbox: IOutbox,
    row: PendingOutboxRow,
    error: unknown,
    fields: { outbox: string; eventId: string; eventType: string }
  ): Promise<Outcome> {
    const attempts = row.attempts + 1
    if (error instanceof InfrastructureError && error.retryable) {
      const now = Date.now()
      const nextDelayMs = backoffMs(attempts)
      await outbox.markRetrying(row.envelope.id, {
        error: describeError(error),
        failedAt: new Date(now),
        nextAttemptAt: new Date(now + nextDelayMs),
      })
      logger.warn('outbox.row.retrying', {
        ...fields,
        attempts,
        nextDelayMs,
        err: error,
      })
      const firstFailedAt = row.firstFailedAt?.getTime() ?? now
      if (
        now - firstFailedAt >= STUCK_AFTER_MS &&
        !this.stuck.has(row.envelope.id)
      ) {
        this.stuck.add(row.envelope.id)
        logger.error('outbox.row.stuck', { ...fields, attempts, err: error })
      }
      return 'retrying'
    }

    await outbox.markFailed(row.envelope.id, { error: describeError(error) })
    logger.error('outbox.row.failed', { ...fields, attempts, err: error })
    return 'failed'
  }
  // #endregion record-failure
}
