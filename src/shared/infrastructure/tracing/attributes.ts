import type { OutboxScope } from '@/shared/kernel/ports/outbox.port'

// The `app.*` attribute keys are a contract with dashboards and alerts
// (ADR 0016). Renaming one needs a new ADR.

// #region attributes
export const APP_MODULE = 'app.module'
export const APP_ERROR_KIND = 'app.error.kind'
export const APP_ERROR_CODE = 'app.error.code'
export const APP_OUTBOX_ROWS = 'app.outbox.rows'
export const APP_OUTBOX_NAME = 'app.outbox.name'
export const APP_OUTBOX_SCOPE = 'app.outbox.scope'
export const APP_OUTBOX_ATTEMPT = 'app.outbox.attempt'
export const APP_EVENT_ID = 'app.event.id'
export const APP_EVENT_TYPE = 'app.event.type'
export const APP_EVENT_CAUSATION_ID = 'app.event.causation_id'
export const APP_EVENT_AGGREGATE_ID = 'app.event.aggregate_id'

/** `expected`: a returned error. `thrown`: an outage or a bug. */
export type ErrorKind = 'expected' | 'thrown'

/**
 * Every attribute our code may write, with its value type. Closed on purpose:
 * a new attribute is a change to this type (ADR 0017). Values are codes, ids
 * and names, never input or the actor.
 */
export type AppAttributes = {
  [APP_MODULE]: string
  [APP_ERROR_KIND]: ErrorKind
  [APP_ERROR_CODE]: string
  [APP_OUTBOX_ROWS]: number
  [APP_OUTBOX_NAME]: string
  [APP_OUTBOX_SCOPE]: OutboxScope
  [APP_OUTBOX_ATTEMPT]: number
  [APP_EVENT_ID]: string
  [APP_EVENT_TYPE]: string
  [APP_EVENT_CAUSATION_ID]: string
  [APP_EVENT_AGGREGATE_ID]: string
}
// #endregion attributes
