import type { DatabaseSync } from 'node:sqlite'

import { toPersistenceError } from '@/shared/infrastructure/sqlite/translate-error'

// #region transaction
/** Returned from a transaction body to roll back without throwing. */
export const ROLLBACK = Symbol('rollback')

/**
 * Runs `body` in `BEGIN IMMEDIATE … COMMIT` (§5). `body` is synchronous, so no
 * other request's statements can run on the shared connection in between.
 * Returning `ROLLBACK` rolls back and returns it. A throw rolls back and is
 * rethrown as a `PersistenceError` for `port`.
 */
export function transaction<T>(
  db: DatabaseSync,
  port: string,
  body: () => T
): T {
  try {
    db.exec('BEGIN IMMEDIATE')
  } catch (error) {
    throw toPersistenceError(port, error)
  }
  try {
    const result = body()
    if (result === ROLLBACK) {
      db.exec('ROLLBACK')
    } else {
      db.exec('COMMIT')
    }
    return result
  } catch (error) {
    if (db.isTransaction) db.exec('ROLLBACK')
    throw toPersistenceError(port, error)
  }
}
// #endregion transaction
