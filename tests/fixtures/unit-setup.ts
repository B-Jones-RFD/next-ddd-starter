import { context, trace } from '@opentelemetry/api'
import { AsyncLocalStorageContextManager } from '@opentelemetry/context-async-hooks'
import {
  InMemorySpanExporter,
  SimpleSpanProcessor,
  TracerProvider,
} from '@opentelemetry/sdk-trace'
import { beforeEach } from 'vitest'

// Vitest never calls `register()`, so the `unit` project registers a real
// tracer in memory (ADR 0012). A second global registration fails, so it is
// registered once per worker and the exporter is shared through globalThis.

type TestTelemetry = { exporter: InMemorySpanExporter }

const globals = globalThis as { __testTelemetry?: TestTelemetry }

if (!globals.__testTelemetry) {
  const exporter = new InMemorySpanExporter()
  const provider = new TracerProvider({
    spanProcessors: [new SimpleSpanProcessor({ exporter })],
  })
  context.setGlobalContextManager(
    new AsyncLocalStorageContextManager().enable()
  )
  trace.setGlobalTracerProvider(provider)
  globals.__testTelemetry = { exporter }
}

beforeEach(() => {
  globals.__testTelemetry?.exporter.reset()
})
