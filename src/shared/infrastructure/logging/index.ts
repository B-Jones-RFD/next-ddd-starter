import 'server-only'

import { randomBytes } from 'node:crypto'

import { isSpanContextValid, trace } from '@opentelemetry/api'
import pino from 'pino'

import type {
  LogEvent,
  LogEventFields,
} from '@/shared/infrastructure/logging/log-events'
import { serializeError } from '@/shared/infrastructure/logging/serialize-error'
import { readObservabilityConfig } from '@/shared/infrastructure/observability-config'

export type {
  LogEvent,
  LogEventFields,
} from '@/shared/infrastructure/logging/log-events'

// #region logger
/** The diagnostic log facade (§8). `pino` is imported nowhere else. */
export type Logger = {
  error<E extends LogEvent>(event: E, fields: LogEventFields[E]): void
  warn<E extends LogEvent>(event: E, fields: LogEventFields[E]): void
  info<E extends LogEvent>(event: E, fields: LogEventFields[E]): void
  debug<E extends LogEvent>(event: E, fields: LogEventFields[E]): void
  child(bindings: { module: string }): Logger
}
// #endregion logger

const config = readObservabilityConfig(process.env)

// #region root
const root = pino({
  level: config.logLevel,
  // pid and hostname are dropped: the OTel resource carries them.
  base: { service: config.serviceName },
  timestamp: pino.stdTimeFunctions.isoTime,
  formatters: { level: (label) => ({ level: label }) },
  // Our own serializer replaces pino's standard one (ADR 0017).
  serializers: { err: serializeError },
  // Correlates each line with the active span.
  mixin() {
    const context = trace.getActiveSpan()?.spanContext()
    if (!context || !isSpanContextValid(context)) return {}
    return {
      trace_id: context.traceId,
      span_id: context.spanId,
      trace_flags: `0${context.traceFlags.toString(16)}`.slice(-2),
    }
  },
})
// #endregion root

function wrap(target: pino.Logger): Logger {
  const write =
    (level: 'error' | 'warn' | 'info' | 'debug') =>
    <E extends LogEvent>(event: E, fields: LogEventFields[E]) => {
      target[level]({ event, ...fields })
    }
  return {
    error: write('error'),
    warn: write('warn'),
    info: write('info'),
    debug: write('debug'),
    child: (bindings) => wrap(target.child(bindings)),
  }
}

export const logger: Logger = wrap(root)

// #region reference
/**
 * The reference a user is shown for an unexpected failure: the active span's
 * trace id, or a fresh id in trace-id format when no span is active, so the
 * reference still finds its `action.unexpected` line.
 */
export function traceReference(): string {
  const context = trace.getActiveSpan()?.spanContext()
  if (context && isSpanContextValid(context)) return context.traceId
  return randomBytes(16).toString('hex')
}
// #endregion reference
