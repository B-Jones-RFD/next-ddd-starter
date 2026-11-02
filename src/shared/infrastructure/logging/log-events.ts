/**
 * The closed set of diagnostic log events (ADR 0013), each with exactly the
 * fields it carries: codes, ids, field names and `err`, never user input.
 * Add an event here on purpose.
 */
export type LogEventFields = {
  /** `to-action-error`, for anything it maps to `unexpected`. */
  'action.unexpected': { reference: string; err: unknown }
  /** `onRequestError`. Never `path`, which can hold input. */
  'request.failed': {
    routePath: string
    routeType: string
    renderSource?: string
    method: string
    err: unknown
  }
  'outbox.row.retrying': {
    outbox: string
    eventId: string
    eventType: string
    attempts: number
    nextDelayMs: number
    err: unknown
  }
  'outbox.row.stuck': {
    outbox: string
    eventId: string
    eventType: string
    attempts: number
    err: unknown
  }
  'outbox.row.recovered': {
    outbox: string
    eventId: string
    eventType: string
    attempts: number
    durationMs: number
  }
  'outbox.row.failed': {
    outbox: string
    eventId: string
    eventType: string
    attempts: number
    err: unknown
  }
  'outbox.row.delivered': {
    outbox: string
    eventId: string
    eventType: string
  }
  'app.started': {
    adapterMode: 'real' | 'mock'
    spanProcessor: string
    metricsExporter: string
    logsExported: boolean
    logLevel: string
  }
  'adapters.mock_fallback': { missing: string[] }
}

export type LogEvent = keyof LogEventFields
