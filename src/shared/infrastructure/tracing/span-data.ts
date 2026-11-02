import { SpanStatusCode, type Span } from '@opentelemetry/api'

import {
  APP_ERROR_CODE,
  APP_ERROR_KIND,
  type AppAttributes,
} from '@/shared/infrastructure/tracing/attributes'
import { AppError } from '@/shared/kernel/errors/app-error'

// The only place span data is written (§8). Lint bans `setAttribute(s)`,
// `addEvent`, `recordException` and `setStatus` everywhere else.

export function setAppAttributes(
  span: Span,
  attributes: Partial<AppAttributes>
): void {
  span.setAttributes(attributes)
}

/** Records a returned error: its code, with the status left unset. */
export function recordExpectedError(span: Span, error: AppError): void {
  setAppAttributes(span, {
    [APP_ERROR_KIND]: 'expected',
    [APP_ERROR_CODE]: error.code,
  })
}

/**
 * Records a thrown error and each link of its `cause` chain as exception
 * events (name, message, stack and code only), and sets `ERROR`.
 */
export function recordThrownError(span: Span, error: unknown): void {
  const code = error instanceof AppError ? error.code : undefined
  setAppAttributes(span, {
    [APP_ERROR_KIND]: 'thrown',
    ...(code ? { [APP_ERROR_CODE]: code } : {}),
  })

  let current: unknown = error
  for (let depth = 0; current !== undefined && depth < 10; depth += 1) {
    if (current instanceof Error) {
      span.recordException({
        name: current.name,
        message: current.message,
        stack: current.stack,
        ...(current instanceof AppError ? { code: current.code } : {}),
      })
      current = current.cause
    } else {
      span.recordException({ name: typeof current, message: String(current) })
      current = undefined
    }
  }

  span.setStatus({
    code: SpanStatusCode.ERROR,
    message: error instanceof Error ? error.message : String(error),
  })
}
