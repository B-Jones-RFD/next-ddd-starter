import { PersistenceError } from '@/shared/kernel/errors/infrastructure-error'

// Primary result codes that mean "try again later".
const SQLITE_BUSY = 5
const SQLITE_LOCKED = 6

function primaryCode(error: unknown): number | undefined {
  if (typeof error !== 'object' || error === null || !('errcode' in error)) {
    return undefined
  }
  const code = error.errcode
  return typeof code === 'number' ? code & 0xff : undefined
}

/**
 * Turns anything a driver call threw into a `PersistenceError` for `port`,
 * keeping the original as `cause` (§5). `SQLITE_BUSY` and `SQLITE_LOCKED` are
 * retryable.
 */
export function toPersistenceError(
  port: string,
  error: unknown
): PersistenceError {
  if (error instanceof PersistenceError) return error
  const code = primaryCode(error)
  return new PersistenceError(port, {
    retryable: code === SQLITE_BUSY || code === SQLITE_LOCKED,
    cause: error,
  })
}

/** Runs a synchronous driver call, translating whatever it throws. */
export function query<T>(port: string, run: () => T): T {
  try {
    return run()
  } catch (error) {
    throw toPersistenceError(port, error)
  }
}
