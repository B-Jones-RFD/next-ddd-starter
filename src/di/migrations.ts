import {
  boards001,
  boards002,
} from '@/modules/boards/infrastructure/migrations'
import {
  identity001,
  identity002,
} from '@/modules/identity/infrastructure/migrations'
import type { Migration } from '@/shared/infrastructure/sqlite/migrate'

/**
 * Every context's migrations, in the order they shipped. Append only:
 * `PRAGMA user_version` counts how many of this list a database has applied.
 */
export const MIGRATIONS: readonly Migration[] = [
  identity001,
  boards001,
  identity002,
  boards002,
]
