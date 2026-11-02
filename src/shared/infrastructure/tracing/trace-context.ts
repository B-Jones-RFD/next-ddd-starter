import {
  createTraceState,
  isSpanContextValid,
  trace,
  type Link,
} from '@opentelemetry/api'

import type { TraceContext } from '@/shared/kernel/ports/outbox.port'

const TRACEPARENT = /^00-([0-9a-f]{32})-([0-9a-f]{16})-([0-9a-f]{2})$/

/** The W3C trace context of the active span, stored with each outbox row. */
export function activeTraceContext(): TraceContext | null {
  const context = trace.getActiveSpan()?.spanContext()
  if (!context || !isSpanContextValid(context)) return null
  const flags = `0${context.traceFlags.toString(16)}`.slice(-2)
  const tracestate = context.traceState?.serialize()
  return {
    traceparent: `00-${context.traceId}-${context.spanId}-${flags}`,
    ...(tracestate ? { tracestate } : {}),
  }
}

/** A span link back to a stored trace context, or none if it doesn't parse. */
export function linkTo(stored: TraceContext | null): Link[] {
  const match = stored ? TRACEPARENT.exec(stored.traceparent) : null
  if (!stored || !match) return []
  const [, traceId = '', spanId = '', flags = '00'] = match
  return [
    {
      context: {
        traceId,
        spanId,
        traceFlags: parseInt(flags, 16),
        isRemote: true,
        ...(stored.tracestate
          ? { traceState: createTraceState(stored.tracestate) }
          : {}),
      },
    },
  ]
}
