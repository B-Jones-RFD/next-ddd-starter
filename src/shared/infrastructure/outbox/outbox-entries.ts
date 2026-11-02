import { activeTraceContext } from '@/shared/infrastructure/tracing/trace-context'
import { uuidv7 } from '@/shared/infrastructure/uuid-v7'
import type {
  DomainEvent,
  EventOrigin,
  IntegrationEvent,
} from '@/shared/kernel/events'
import type { OutboxEntry } from '@/shared/kernel/ports/outbox.port'

/**
 * The outbox rows for one `save` (§6): each domain event as a `domain` row
 * and each translation as an `integration` row, all with the aggregate's new
 * version and the trace context of the active span. Build them before the
 * transaction starts.
 */
export function outboxEntries(input: {
  aggregateId: string
  aggregateVersion: number
  origin: EventOrigin
  domainEvents: readonly DomainEvent[]
  integrationEvents: readonly IntegrationEvent[]
}): OutboxEntry[] {
  const occurredAt = new Date().toISOString()
  const traceContext = activeTraceContext()
  const envelope = (
    type: string,
    version: number,
    payload: unknown
  ): OutboxEntry['envelope'] => ({
    id: uuidv7(),
    type,
    version,
    occurredAt,
    aggregateId: input.aggregateId,
    aggregateVersion: input.aggregateVersion,
    actorId: input.origin.actorId,
    causationId: input.origin.causationId,
    payload,
  })

  return [
    ...input.domainEvents.map((event) => ({
      scope: 'domain' as const,
      envelope: envelope(event.type, 1, event.payload),
      traceContext,
    })),
    ...input.integrationEvents.map((event) => ({
      scope: 'integration' as const,
      envelope: envelope(event.type, event.version, event.payload),
      traceContext,
    })),
  ]
}
