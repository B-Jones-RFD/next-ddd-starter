import {
  DataPointType,
  MeterProvider,
  MetricReader,
} from '@opentelemetry/sdk-metrics'
import { beforeEach, describe, expect, it } from 'vitest'

import { registerOutboxGauges } from '@/shared/infrastructure/metrics/outbox-gauges'
import { resetMockStores } from '@/shared/infrastructure/mock-stores'
import { MockOutbox } from '@/shared/infrastructure/outbox/outbox.mock'

import { anOutboxEntry } from '@tests/fixtures/envelopes'

class TestReader extends MetricReader {
  protected override async onForceFlush(): Promise<void> {}
  protected override async onShutdown(): Promise<void> {}
}

describe('registerOutboxGauges', () => {
  beforeEach(() => {
    resetMockStores()
  })

  it('reports one point per outbox for each of the three gauges', async () => {
    const reader = new TestReader()
    const provider = new MeterProvider({ readers: [reader] })
    const identity = new MockOutbox('identity')
    const boards = new MockOutbox('boards')
    const stale = anOutboxEntry({ occurredAt: new Date(0).toISOString() })
    identity.append([stale, anOutboxEntry()])
    await identity.markFailed(stale.envelope.id, { error: 'bug' })
    boards.append([anOutboxEntry()])

    registerOutboxGauges(provider.getMeter('test'), [identity, boards])
    const { resourceMetrics } = await reader.collect()

    const metrics = resourceMetrics.scopeMetrics.flatMap((s) => s.metrics)
    const points = (name: string) =>
      Object.fromEntries(
        (metrics.find((m) => m.descriptor.name === name)?.dataPoints ?? []).map(
          (point) => [point.attributes['app.outbox.name'], point.value]
        )
      )
    expect(metrics.every((m) => m.dataPointType === DataPointType.GAUGE)).toBe(
      true
    )
    expect(points('app.outbox.pending')).toEqual({ identity: 1, boards: 1 })
    expect(points('app.outbox.failed')).toEqual({ identity: 1, boards: 0 })
    expect(Object.keys(points('app.outbox.oldest_pending.age'))).toEqual([
      'identity',
      'boards',
    ])
    await provider.shutdown()
  })
})
