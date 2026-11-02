import type { Instrumentation } from 'next'

/**
 * Runs once per server instance, before any request (§8). Starts telemetry,
 * then the outbox relay. Node only; not run during `next build`.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return
  const { start } = await import('./instrumentation.node')
  await start()
}

/**
 * Logs a throw from a page, layout or route handler once, as
 * `request.failed` (§8). Never `request.path`, which can hold input.
 */
export const onRequestError: Instrumentation.onRequestError = async (
  error,
  request,
  context
) => {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return
  const { logger } = await import('@/shared/infrastructure/logging')
  logger.error('request.failed', {
    routePath: context.routePath,
    routeType: context.routeType,
    renderSource: context.renderSource,
    method: request.method,
    err: error,
  })
}
