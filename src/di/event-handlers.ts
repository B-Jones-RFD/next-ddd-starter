import { AUDIT_HANDLERS } from '@/modules/audit/application/handlers/audit-handlers'
import {
  RECORD_USER_REGISTERED,
  recordUserRegistered,
} from '@/modules/boards/application/handlers/record-user-registered'
import {
  RECORD_USER_RENAMED,
  recordUserRenamed,
} from '@/modules/boards/application/handlers/record-user-renamed'
import {
  UNTAG_DELETED_TAG,
  untagDeletedTag,
} from '@/modules/boards/application/handlers/untag-deleted-tag'
import {
  eventHandler,
  type EventHandler,
} from '@/shared/kernel/ports/event-relay.port'

/** The modules that own an outbox, which the relay drains in this order. */
export const OUTBOX_NAMES = ['identity', 'boards', 'audit'] as const

/** Every outbox handler, registered with the relay (§6). */
export const EVENT_HANDLERS: readonly EventHandler[] = [
  eventHandler({
    name: RECORD_USER_REGISTERED,
    eventType: 'identity.UserRegistered',
    version: 1,
    handle: recordUserRegistered,
  }),
  eventHandler({
    name: RECORD_USER_RENAMED,
    eventType: 'identity.UserRenamed',
    version: 1,
    handle: recordUserRenamed,
  }),
  // A domain row: only boards' own handlers receive it (§6).
  eventHandler({
    name: UNTAG_DELETED_TAG,
    eventType: 'TagDeleted',
    version: 1,
    handle: untagDeletedTag,
  }),
  // One per identity and boards v1 contract (ADR 0010).
  ...AUDIT_HANDLERS,
]
