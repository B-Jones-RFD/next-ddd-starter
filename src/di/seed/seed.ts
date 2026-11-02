import { getInjection } from '@/di/container'
import { signUp } from '@/modules/identity/api'

/** Seeded users all share this password. */
export const SEED_PASSWORD = 'password'

/** Ada (Owner), Ben (Member) and Cy (outsider), once boards exist (#60). */
const PEOPLE = [
  { displayName: 'Ada', email: 'ada@example.com' },
  { displayName: 'Ben', email: 'ben@example.com' },
  { displayName: 'Cy', email: 'cy@example.com' },
] as const

/**
 * Builds the seed through `api.ts` commands, exactly as a user would, then
 * drains the relay so every projection is up to date. Re-running it skips
 * what already exists.
 */
export async function seed(): Promise<void> {
  for (const person of PEOPLE) {
    const result = await signUp({ ...person, password: SEED_PASSWORD })
    if (!result.ok && result.error.code !== 'identity.email-taken') {
      throw result.error
    }
  }
  await (await getInjection('IEventRelay')).drain()
}
