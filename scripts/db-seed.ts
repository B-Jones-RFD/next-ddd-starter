// `npm run db:seed`: signs up Ada, Ben and Cy (password `password`) through
// api.ts, then drains the relay before exiting. Run with
// --conditions=react-server (§8), after `npm run db:migrate`.
import { getAdapterMode } from '@/di/container'
import { seed, SEED_PASSWORD } from '@/di/seed/seed'

async function main() {
  if (getAdapterMode() !== 'real') {
    throw new Error('Set DATABASE_PATH to seed a database.')
  }
  await seed()
  process.stdout.write(
    `Seeded ada@, ben@ and cy@example.com (password "${SEED_PASSWORD}").\n`
  )
}

void main()
