import type { DatabaseSync } from 'node:sqlite'

import { MIGRATIONS } from '@/di/migrations'
import { openDatabase } from '@/shared/infrastructure/sqlite/database'
import { migrate } from '@/shared/infrastructure/sqlite/migrate'

/** A fresh `:memory:` database with the production migrations, for contract suites. */
export function givenMigratedDatabase(): DatabaseSync {
  const db = openDatabase(':memory:')
  migrate(db, MIGRATIONS)
  return db
}
