import type { EventEnvelope } from '@/shared/kernel/events'
import type { OutboxEntry } from '@/shared/kernel/ports/outbox.port'
import { toUserId } from '@/shared/kernel/user-id'

let sequence = 0

/** An envelope with sensible defaults, for outbox and relay tests. */
export function anEnvelope(
  overrides: Partial<EventEnvelope> = {}
): EventEnvelope {
  sequence += 1
  return {
    id: `00000000-0000-7000-8000-${String(sequence).padStart(12, '0')}`,
    type: 'identity.UserRegistered',
    version: 1,
    occurredAt: new Date().toISOString(),
    aggregateId: `user-${sequence}`,
    aggregateVersion: 1,
    actorId: toUserId(`user-${sequence}`),
    causationId: null,
    payload: { userId: `user-${sequence}`, displayName: 'Ada' },
    ...overrides,
  }
}

/** An integration-scope outbox entry wrapping `anEnvelope(overrides)`. */
export function anOutboxEntry(
  overrides: Partial<EventEnvelope> = {}
): OutboxEntry {
  return {
    scope: 'integration',
    envelope: anEnvelope(overrides),
    traceContext: null,
  }
}
