import { trace } from '@opentelemetry/api'

import { APP_MODULE } from '@/shared/infrastructure/tracing/attributes'
import {
  recordExpectedError,
  recordThrownError,
  setAppAttributes,
} from '@/shared/infrastructure/tracing/span-data'
import { AppError } from '@/shared/kernel/errors/app-error'

const tracer = trace.getTracer('next-ddd-starter')

function isFailedResult(
  value: unknown
): value is { ok: false; error: AppError } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'ok' in value &&
    value.ok === false &&
    'error' in value &&
    value.error instanceof AppError
  )
}

// #region traced
/**
 * Wraps a use case in a span named `<module>.<exportName>` (§8). It sets
 * `app.module`, records an expected error's code, records a thrown error with
 * its cause and rethrows the same object. It records nothing from the input,
 * never the actor, and never logs.
 */
export function traced<Args extends unknown[], R>(
  name: string,
  useCase: (...args: Args) => Promise<R>
): (...args: Args) => Promise<R> {
  const moduleName = name.slice(0, name.indexOf('.'))

  return (...args: Args) =>
    tracer.startActiveSpan(name, async (span) => {
      setAppAttributes(span, { [APP_MODULE]: moduleName })
      try {
        const result = await useCase(...args)
        if (isFailedResult(result)) recordExpectedError(span, result.error)
        return result
      } catch (error) {
        recordThrownError(span, error)
        throw error
      } finally {
        span.end()
      }
    })
}
// #endregion traced
