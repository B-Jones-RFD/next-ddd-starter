import {
  InfrastructureError,
  PersistenceError,
} from '@/shared/kernel/errors/infrastructure-error'

/**
 * Runs an anti-corruption adapter's call into another context's `api.ts`
 * (§6), rethrowing any outage as the calling port's own `PersistenceError`,
 * with the same `retryable` and the original as `cause`, so the supplier's
 * classes never reach the consumer. Anything else is rethrown as it is.
 */
export async function askContext<T>(
  port: string,
  ask: () => Promise<T>
): Promise<T> {
  try {
    return await ask()
  } catch (error) {
    if (error instanceof InfrastructureError) {
      throw new PersistenceError(port, {
        retryable: error.retryable,
        cause: error,
      })
    }
    throw error
  }
}
