const EXPORTERS = ['otlp', 'console', 'none'] as const
const LOG_EXPORTERS = ['otlp', 'none'] as const
const LOG_LEVELS = [
  'error',
  'warn',
  'info',
  'debug',
  'trace',
  'silent',
] as const

export type Exporter = (typeof EXPORTERS)[number]
export type LogExporter = (typeof LOG_EXPORTERS)[number]
export type LogLevel = (typeof LOG_LEVELS)[number]

export type ObservabilityConfig = {
  tracesExporter: Exporter
  metricsExporter: Exporter
  logsExporter: LogExporter
  metricExportIntervalMs: number
  metricExportTimeoutMs: number
  logLevel: LogLevel
  serviceName: string
}

function oneOf<T extends string>(
  env: NodeJS.ProcessEnv,
  name: string,
  allowed: readonly T[],
  fallback: T
): T {
  const value = env[name]
  if (value === undefined || value === '') return fallback
  if ((allowed as readonly string[]).includes(value)) return value as T
  throw new Error(
    `${name} must be one of ${allowed.join(', ')}, got "${value}".`
  )
}

function milliseconds(
  env: NodeJS.ProcessEnv,
  name: string,
  fallback: number
): number {
  const value = env[name]
  if (value === undefined || value === '') return fallback
  if (!/^\d+$/.test(value)) {
    throw new Error(`${name} must be a whole number of milliseconds.`)
  }
  return Number(value)
}

function defaultLogLevel(env: NodeJS.ProcessEnv): LogLevel {
  if (env.NODE_ENV === 'test') return 'silent'
  if (env.NODE_ENV === 'production') return 'info'
  return 'debug'
}

// #region reader
/**
 * Reads observability settings from the standard `OTEL_*` variables plus
 * `LOG_LEVEL` (ADR 0015). Every exporter defaults to `none`. Throws on any
 * unknown value, and on `OTEL_SDK_DISABLED=true`, which would remove the
 * tracer provider and with it the trace id users get as a reference.
 */
export function readObservabilityConfig(
  env: NodeJS.ProcessEnv
): ObservabilityConfig {
  if (env.OTEL_SDK_DISABLED?.toLowerCase() === 'true') {
    throw new Error(
      'OTEL_SDK_DISABLED is not supported. To export nothing, set OTEL_TRACES_EXPORTER=none.'
    )
  }

  return {
    tracesExporter: oneOf(env, 'OTEL_TRACES_EXPORTER', EXPORTERS, 'none'),
    metricsExporter: oneOf(env, 'OTEL_METRICS_EXPORTER', EXPORTERS, 'none'),
    logsExporter: oneOf(env, 'OTEL_LOGS_EXPORTER', LOG_EXPORTERS, 'none'),
    metricExportIntervalMs: milliseconds(
      env,
      'OTEL_METRIC_EXPORT_INTERVAL',
      60_000
    ),
    metricExportTimeoutMs: milliseconds(
      env,
      'OTEL_METRIC_EXPORT_TIMEOUT',
      30_000
    ),
    logLevel: oneOf(env, 'LOG_LEVEL', LOG_LEVELS, defaultLogLevel(env)),
    serviceName: env.OTEL_SERVICE_NAME || 'next-ddd-starter',
  }
}
// #endregion reader
