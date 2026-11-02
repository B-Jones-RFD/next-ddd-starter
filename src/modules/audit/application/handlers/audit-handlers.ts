import { getInjection } from '@/di/container'
import {
  translate,
  TRANSLATIONS,
  type AuditedEventType,
} from '@/modules/audit/application/handlers/translations'
import type { EventEnvelope } from '@/shared/kernel/events'
import {
  eventHandler,
  type EventHandler,
} from '@/shared/kernel/ports/event-relay.port'

/** `boards.TaskMoved` → `audit.recordTaskMoved`. */
export function handlerName(eventType: AuditedEventType): string {
  return `audit.record${eventType.slice(eventType.indexOf('.') + 1)}`
}

// #region record
/**
 * Records one event as its Audit entry, with its names and its inbox row, in
 * one transaction. The entry's id is the event's, so a redelivery is a no-op.
 */
function recordWith(eventType: AuditedEventType): EventHandler {
  const name = handlerName(eventType)
  return eventHandler({
    name,
    eventType,
    version: 1,
    handle: async (envelope: EventEnvelope) => {
      const { entry, names } = translate(envelope)
      const log = await getInjection('IAuditLog')
      await log.record(entry, names, { eventId: envelope.id, handler: name })
    },
  })
}
// #endregion record

/** Audit's handlers: one per event contract it translates. */
export const AUDIT_HANDLERS: readonly EventHandler[] = (
  Object.keys(TRANSLATIONS) as AuditedEventType[]
).map(recordWith)
