import { getInjection } from '@/di/container'
import { getActivity } from '@/modules/audit/api'
import {
  addComment,
  addMember,
  createBoard,
  createList,
  createTask,
  getBoard,
  listBoards,
} from '@/modules/boards/api'
import { authenticate, signIn, signUp } from '@/modules/identity/api'
import type { UserId } from '@/shared/kernel/user-id'

/** Seeded users all share this password. */
export const SEED_PASSWORD = 'password'

type Person = { displayName: string; email: string }

// Ada (Owner), Ben (Member) and Cy (outsider).
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

/** Adds each named task to the end of its list, unless the list has it. */
async function tasks(
  actorId: UserId,
  boardId: string,
  byList: Readonly<Record<string, readonly string[]>>
): Promise<void> {
  const existing = await getBoard({ actorId, boardId })
  if (!existing.ok) throw existing.error
  for (const list of existing.value.lists) {
    for (const title of byList[list.name] ?? []) {
      if (list.tasks.some((task) => task.title === title)) continue
      const created = await createTask({ actorId, listId: list.id, title })
      if (!created.ok) throw created.error
    }
  }
}

type SeedComment = { task: string; authorId: UserId; text: string }

/**
 * Posts each comment on the task of that title, in order, unless its
 * Activity already has it. Reads Activity, so the relay must be drained.
 */
async function comments(
  actorId: UserId,
  boardId: string,
  wanted: readonly SeedComment[]
): Promise<void> {
  const existing = await getBoard({ actorId, boardId })
  if (!existing.ok) throw existing.error
  const tasks = existing.value.lists.flatMap((list) => list.tasks)
  for (const comment of wanted) {
    const task = tasks.find((t) => t.title === comment.task)
    if (!task) continue
    const activity = await getActivity({ actorId, taskId: task.id })
    if (!activity.ok) throw activity.error
    const posted = activity.value.entries.some(
      (entry) =>
        entry.action === 'comment.added' &&
        entry.actorId === comment.authorId &&
        entry.details.text === comment.text
    )
    if (posted) continue
    const added = await addComment({
      actorId: comment.authorId,
      taskId: task.id,
      text: comment.text,
    })
    if (!added.ok) throw added.error
  }
}

/** The Owner adds `userId` as a Member, unless they already are one. */
async function member(
  ownerId: UserId,
  boardId: string,
  userId: UserId
): Promise<void> {
  const added = await addMember({ actorId: ownerId, boardId, userId })
  if (!added.ok && added.error.code !== 'boards.board.already-a-member') {
    throw added.error
  }
}

/**
 * Builds the seed through `api.ts` commands, exactly as a user would, then
 * drains the relay so every projection is up to date. Re-running it skips
 * what already exists.
 */
export async function seed(): Promise<void> {
  const relay = await getInjection('IEventRelay')
  const ada = await person(ADA)
  const ben = await person(BEN)
  await person(CY)
  // Boards learns who Ben is from identity's events before he can be added.
  await relay.drain()
  const launchPlan = await board(ada, 'Launch plan')
  await member(ada, launchPlan, ben)
  await lists(ada, launchPlan, ['Backlog', 'In progress', 'Done'])
  await tasks(ada, launchPlan, {
    Backlog: [
      'Write the press release',
      'Plan the launch event',
      'Update the FAQ',
    ],
    'In progress': [
      'Design the landing page',
      'Record the demo video',
      'Brief support',
    ],
    Done: ['Pick the launch date', 'Set up analytics'],
  })
  // Comments are checked against Activity, which trails by one drain.
  await relay.drain()
  await comments(ada, launchPlan, [
    {
      task: 'Write the press release',
      authorId: ada,
      text: 'Draft by Friday, please.',
    },
    {
      task: 'Write the press release',
      authorId: ben,
      text: 'On it. I’ll share a first pass on Thursday.',
    },
    {
      task: 'Design the landing page',
      authorId: ben,
      text: 'Should the hero use a still from the demo video?',
    },
    {
      task: 'Pick the launch date',
      authorId: ada,
      text: 'Locked in for the 14th.',
    },
  ])
  await relay.drain()
}
