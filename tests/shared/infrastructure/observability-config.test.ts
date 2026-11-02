import { describe, expect, it } from 'vitest'

import { readObservabilityConfig } from '@/shared/infrastructure/observability-config'

const env = (vars: Record<string, string>) => vars as NodeJS.ProcessEnv

describe('readObservabilityConfig', () => {
  it('defaults every exporter to none', () => {
    const config = readObservabilityConfig(env({ NODE_ENV: 'development' }))

    expect(config).toMatchObject({
      tracesExporter: 'none',
      metricsExporter: 'none',
      logsExporter: 'none',
      metricExportIntervalMs: 60_000,
      metricExportTimeoutMs: 30_000,
      serviceName: 'next-ddd-starter',
    })
  })

  it.each([
    ['production', 'info'],
    ['development', 'debug'],
    ['test', 'silent'],
  ])('defaults LOG_LEVEL in %s to %s', (nodeEnv, level) => {
    expect(readObservabilityConfig(env({ NODE_ENV: nodeEnv })).logLevel).toBe(
      level
    )
  })

  it('reads the standard variables', () => {
    const config = readObservabilityConfig(
      env({
        NODE_ENV: 'production',
        OTEL_TRACES_EXPORTER: 'otlp',
        OTEL_METRICS_EXPORTER: 'console',
        OTEL_LOGS_EXPORTER: 'otlp',
        OTEL_METRIC_EXPORT_INTERVAL: '5000',
        OTEL_METRIC_EXPORT_TIMEOUT: '2000',
        OTEL_SERVICE_NAME: 'boards-api',
        LOG_LEVEL: 'warn',
      })
    )

    expect(config).toEqual({
      tracesExporter: 'otlp',
      metricsExporter: 'console',
      logsExporter: 'otlp',
      metricExportIntervalMs: 5000,
      metricExportTimeoutMs: 2000,
      serviceName: 'boards-api',
      logLevel: 'warn',
    })
  })

  it.each([
    ['OTEL_TRACES_EXPORTER', 'jaeger'],
    ['OTEL_METRICS_EXPORTER', 'prometheus'],
    ['OTEL_LOGS_EXPORTER', 'console'],
    ['LOG_LEVEL', 'fatal'],
    ['OTEL_METRIC_EXPORT_INTERVAL', 'soon'],
    ['OTEL_METRIC_EXPORT_TIMEOUT', '-1'],
  ])('throws on an unknown %s', (name, value) => {
    expect(() => readObservabilityConfig(env({ [name]: value }))).toThrow(name)
  })

  it('refuses OTEL_SDK_DISABLED=true and points to traces at none', () => {
    expect(() =>
      readObservabilityConfig(env({ OTEL_SDK_DISABLED: 'true' }))
    ).toThrow('OTEL_TRACES_EXPORTER=none')
  })
})
