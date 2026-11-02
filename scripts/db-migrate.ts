// `npm run db:migrate`: applies every context's pending migrations to
// DATABASE_PATH (§5). Run with --conditions=react-server (§8).
import { MIGRATIONS } from '@/di/migrations'
import { openDatabase } from '@/shared/infrastructure/sqlite/database'
import { migrate } from '@/shared/infrastructure/sqlite/migrate'

const path = process.env.DATABASE_PATH
if (!path) {
  throw new Error('Set DATABASE_PATH to the SQLite file to migrate.')
}

const db = openDatabase(path)
const applied = migrate(db, MIGRATIONS)
db.close()
process.stdout.write(
  `Applied ${applied} migration(s); ${path} is at version ${MIGRATIONS.length}.\n`
)
