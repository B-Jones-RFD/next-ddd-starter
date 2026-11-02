import {
  RECORD_USER_REGISTERED,
  recordUserRegistered,
} from '@/modules/boards/application/handlers/record-user-registered'
import {
  eventHandler,
  type EventHandler,
} from '@/shared/kernel/ports/event-relay.port'

/** The modules that own an outbox, which the relay drains in this order. */
export const OUTBOX_NAMES = ['identity', 'boards'] as const

/** Every outbox handler, registered with the relay (§6). */
export const EVENT_HANDLERS: readonly EventHandler[] = [
  eventHandler({
    name: RECORD_USER_REGISTERED,
    eventType: 'identity.UserRegistered',
    version: 1,
    handle: recordUserRegistered,
  }),
]
