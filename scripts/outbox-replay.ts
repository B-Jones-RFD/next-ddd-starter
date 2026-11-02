// `npm run outbox:replay`: makes every context's failed outbox rows pending
// again (§6), once the bug that failed them is fixed. The running app's
// relay delivers them on its next poll, and inboxes drop anything a handler
// already applied. Run with --conditions=react-server (§8).
import { getAdapterMode, getInjection } from '@/di/container'

async function main() {
  if (getAdapterMode() !== 'real') {
    throw new Error('Set DATABASE_PATH to the SQLite file to replay.')
  }
  const relay = await getInjection('IEventRelay')
  const replayed = await relay.replayFailed()
  process.stdout.write(
    `Replayed ${replayed} failed outbox row(s); the relay delivers them next.\n`
  )
}

void main()
