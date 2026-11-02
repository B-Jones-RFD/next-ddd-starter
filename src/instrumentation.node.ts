import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-proto'
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-proto'
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-proto'
import { PinoInstrumentation } from '@opentelemetry/instrumentation-pino'
import { BatchLogRecordProcessor } from '@opentelemetry/sdk-logs'
import {
  ConsoleMetricExporter,
  PeriodicExportingMetricReader,
} from '@opentelemetry/sdk-metrics'
import { NodeSDK } from '@opentelemetry/sdk-node'
import {
  BatchSpanProcessor,
  ConsoleSpanExporter,
  NoopSpanProcessor,
  SimpleSpanProcessor,
} from '@opentelemetry/sdk-trace'

import {
  readObservabilityConfig,
  type ObservabilityConfig,
} from '@/shared/infrastructure/observability-config'

// The Node half of `register()` (ADRs 0015 to 0017). Our code builds every
// processor and reader from the validated config, so NodeSDK never picks
// from env itself, and no sampler is set here.

// #region span-processor
function spanProcessor(config: ObservabilityConfig) {
  switch (config.tracesExporter) {
    case 'otlp':
      return new BatchSpanProcessor({ exporter: new OTLPTraceExporter() })
    case 'console':
      return new SimpleSpanProcessor({ exporter: new ConsoleSpanExporter() })
    case 'none':
      // Keeps the provider, so every request still has a trace id.
      return new NoopSpanProcessor()
  }
}
// #endregion span-processor

function metricReaders(config: ObservabilityConfig) {
  const options = {
    exportIntervalMillis: config.metricExportIntervalMs,
    exportTimeoutMillis: config.metricExportTimeoutMs,
  }
  switch (config.metricsExporter) {
    case 'otlp':
      return [
        new PeriodicExportingMetricReader({
          exporter: new OTLPMetricExporter(),
          ...options,
        }),
      ]
    case 'console':
      return [
        new PeriodicExportingMetricReader({
          exporter: new ConsoleMetricExporter(),
          ...options,
        }),
      ]
    case 'none':
      return []
  }
}

const globals = globalThis as { __appStarted?: boolean }

/** Starts the SDK, then the relay, once per process. */
export async function start(): Promise<void> {
  if (globals.__appStarted) return
  globals.__appStarted = true

  const config = readObservabilityConfig(process.env)
  const logsExported = config.logsExporter === 'otlp'
  const sdk = new NodeSDK({
    serviceName: config.serviceName,
    spanProcessors: [spanProcessor(config)],
    metricReaders: metricReaders(config),
    logRecordProcessors: logsExported
      ? [new BatchLogRecordProcessor({ exporter: new OTLPLogExporter() })]
      : [],
    instrumentations: [
      new PinoInstrumentation({
        // The facade's mixin already correlates lines with spans.
        disableLogCorrelation: true,
        disableLogSending: !logsExported,
      }),
    ],
  })
  sdk.start()

  // Loaded after the SDK, so pino is patched and spans have a provider.
  const [{ getAdapterMode, getInjection }, { logger }] = await Promise.all([
    import('@/di/container'),
    import('@/shared/infrastructure/logging'),
  ])

  const adapterMode = getAdapterMode()
  ;(await getInjection('IEventRelay')).start()

  if (adapterMode === 'mock' && process.env.NODE_ENV === 'development') {
    const { seed } = await import('@/di/seed/seed')
    await seed()
  }

  // #region app-started
  const level =
    process.env.NODE_ENV === 'production' && config.tracesExporter === 'none'
      ? 'warn'
      : 'info'
  logger[level]('app.started', {
    adapterMode,
    spanProcessor: config.tracesExporter,
    metricsExporter: config.metricsExporter,
    logsExported,
    logLevel: config.logLevel,
  })
  // #endregion app-started
}
