import 'server-only'

import { metrics, type Meter } from '@opentelemetry/api'

/**
 * The one way to get a meter (§8). Call it only after `register()` has
 * started the SDK: unlike tracing, the metrics API has no proxy, so a meter
 * obtained earlier is a no-op forever. That is why this is a function, not a
 * module-level constant.
 */
export function getMeter(): Meter {
  return metrics.getMeter('next-ddd-starter')
}
