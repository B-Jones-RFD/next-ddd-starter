import { trace } from '@opentelemetry/api'
import type {
  InMemorySpanExporter,
  ReadableSpan,
} from '@opentelemetry/sdk-trace'

// Used only by the tests that check telemetry once (§8): `traced` and the
// `reference` from `to-action-error`. Feature tests never assert on spans.

function exporter(): InMemorySpanExporter {
  const telemetry = (
    globalThis as { __testTelemetry?: { exporter: InMemorySpanExporter } }
  ).__testTelemetry
  if (!telemetry) throw new Error('The unit setup file has not run.')
  return telemetry.exporter
}

/** Spans ended since the current test began, in end order. */
export function recordedSpans(): ReadableSpan[] {
  return exporter().getFinishedSpans()
}

/** Runs `fn` inside an active test span and passes it that span's trace id. */
export async function withTestSpan<T>(
  fn: (traceId: string) => Promise<T> | T
): Promise<T> {
  return trace.getTracer('tests').startActiveSpan('test', async (span) => {
    try {
      return await fn(span.spanContext().traceId)
    } finally {
      span.end()
    }
  })
}
