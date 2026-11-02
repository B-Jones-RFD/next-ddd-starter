import type { DatabaseSync } from 'node:sqlite'

/** One forward-only schema change, owned by a context. */
export type Migration = {
  readonly context: string
  readonly name: string
  readonly sql: string
}

/**
 * Applies the migrations that `PRAGMA user_version` hasn't seen yet, each in
 * its own transaction (§5). The list is append-only: `user_version` counts
 * how many of it have been applied, so a migration is never edited, reordered
 * or removed once it has shipped. Returns how many were applied.
 */
export function migrate(
  db: DatabaseSync,
  migrations: readonly Migration[]
): number {
  const row = db.prepare('PRAGMA user_version').get() as
    { user_version: number } | undefined
  const applied = row?.user_version ?? 0
  if (applied > migrations.length) {
    throw new Error(
      `The database is at schema version ${applied}, newer than this code (${migrations.length}).`
    )
  }

  for (let index = applied; index < migrations.length; index += 1) {
    const migration = migrations[index]
    if (!migration) break
    db.exec('BEGIN IMMEDIATE')
    try {
      db.exec(migration.sql)
      db.exec(`PRAGMA user_version = ${index + 1}`)
      db.exec('COMMIT')
    } catch (error) {
      db.exec('ROLLBACK')
      throw new Error(
        `Migration ${index + 1} (${migration.context}/${migration.name}) failed.`,
        { cause: error }
      )
    }
  }
  return migrations.length - applied
}
