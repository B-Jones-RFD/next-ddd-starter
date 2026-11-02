import { getInjection } from '@/di/container'
import {
  createBoard,
  createList,
  getBoard,
  listBoards,
} from '@/modules/boards/api'
import { authenticate, signIn, signUp } from '@/modules/identity/api'
import type { UserId } from '@/shared/kernel/user-id'

/** Seeded users all share this password. */
export const SEED_PASSWORD = 'password'

type Person = { displayName: string; email: string }

// Ada (Owner), Ben (Member) and Cy (outsider), once membership exists (#60).
const ADA: Person = { displayName: 'Ada', email: 'ada@example.com' }
const BEN: Person = { displayName: 'Ben', email: 'ben@example.com' }
const CY: Person = { displayName: 'Cy', email: 'cy@example.com' }

/** Signs the person up, or in if they already exist, and returns their id. */
async function person(entry: Person): Promise<UserId> {
  const credentials = { email: entry.email, password: SEED_PASSWORD }
  const signedUp = await signUp({ ...entry, password: SEED_PASSWORD })
  if (!signedUp.ok && signedUp.error.code !== 'identity.email-taken') {
    throw signedUp.error
  }
  const session = signedUp.ok ? signedUp : await signIn(credentials)
  if (!session.ok) throw session.error
  const actor = await authenticate(session.value.token)
  if (!actor.ok) throw actor.error
  return actor.value.userId
}

/**
 * Creates the board for `actorId`, unless they already have one by that
 * name, and returns its id.
 */
async function board(actorId: UserId, name: string): Promise<string> {
  const existing = await listBoards({ actorId })
  if (!existing.ok) throw existing.error
  const found = existing.value.find((b) => b.name === name)
  if (found) return found.id
  const created = await createBoard({ actorId, name })
  if (!created.ok) throw created.error
  return created.value.boardId
}

/** Adds each named list to the end of the board, unless it already has it. */
async function lists(
  actorId: UserId,
  boardId: string,
  names: readonly string[]
): Promise<void> {
  const existing = await getBoard({ actorId, boardId })
  if (!existing.ok) throw existing.error
  for (const name of names) {
    if (existing.value.lists.some((list) => list.name === name)) continue
    const created = await createList({ actorId, boardId, name })
    if (!created.ok) throw created.error
  }
}

/**
 * Builds the seed through `api.ts` commands, exactly as a user would, then
 * drains the relay so every projection is up to date. Re-running it skips
 * what already exists.
 */
export async function seed(): Promise<void> {
  const ada = await person(ADA)
  await person(BEN)
  await person(CY)
  const launchPlan = await board(ada, 'Launch plan')
  await lists(ada, launchPlan, ['Backlog', 'In progress', 'Done'])
  await (await getInjection('IEventRelay')).drain()
}
