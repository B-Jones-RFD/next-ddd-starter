import { DatabaseSync } from 'node:sqlite'

/** Opens a connection with the pragmas every connection gets. */
export function openDatabase(path: string): DatabaseSync {
  const db = new DatabaseSync(path)
  db.exec('PRAGMA journal_mode = WAL')
  db.exec('PRAGMA busy_timeout = 5000')
  return db
}

const globals = globalThis as { __database?: DatabaseSync }

/**
 * The one shared connection every context uses (§13), opened from
 * `DATABASE_PATH` on first use. It lives on `globalThis`, so every bundle in
 * the process shares it.
 */
export function getDatabase(): DatabaseSync {
  if (!globals.__database) {
    const path = process.env.DATABASE_PATH
    if (!path) throw new Error('DATABASE_PATH is not set.')
    globals.__database = openDatabase(path)
  }
  return globals.__database
}
