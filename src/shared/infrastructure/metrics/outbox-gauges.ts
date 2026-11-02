import type { Meter } from '@opentelemetry/api'

import { APP_OUTBOX_NAME } from '@/shared/infrastructure/tracing/attributes'
import type { IOutbox } from '@/shared/kernel/ports/outbox.port'

/**
 * Registers the three outbox backlog gauges (ADR 0014), each with only
 * `app.outbox.name`. One batch callback reads `backlog()` from every outbox
 * at collection time.
 */
export function registerOutboxGauges(
  meter: Meter,
  outboxes: readonly IOutbox[]
): void {
  const pending = meter.createObservableGauge('app.outbox.pending', {
    unit: '{row}',
    description: 'Outbox rows neither delivered nor failed.',
  })
  const oldestAge = meter.createObservableGauge(
    'app.outbox.oldest_pending.age',
    { unit: 's', description: 'Age of the oldest pending outbox row.' }
  )
  const failed = meter.createObservableGauge('app.outbox.failed', {
    unit: '{row}',
    description: 'Outbox rows marked failed, waiting for a replay.',
  })

  meter.addBatchObservableCallback(
    async (result) => {
      const now = Date.now()
      for (const outbox of outboxes) {
        const backlog = await outbox.backlog()
        const attributes = { [APP_OUTBOX_NAME]: outbox.name }
        result.observe(pending, backlog.pending, attributes)
        result.observe(
          oldestAge,
          backlog.oldestPendingAt
            ? Math.max(0, (now - backlog.oldestPendingAt.getTime()) / 1000)
            : 0,
          attributes
        )
        result.observe(failed, backlog.failed, attributes)
      }
    },
    [pending, oldestAge, failed]
  )
}
