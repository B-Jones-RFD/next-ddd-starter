import { getInjection } from '@/di/container'
import { authenticate, signUp } from '@/modules/identity/api'
import type { UserId } from '@/shared/kernel/user-id'

import { aSignUp } from '@tests/fixtures/identity'

/**
 * Signs a user up through identity's `api.ts` and drains the relay, so boards
 * knows their display name. Returns their id, for application tests.
 */
export async function givenUser(
  displayName: string,
  email?: string
): Promise<UserId> {
  const signedUp = await signUp(
    aSignUp(email ? { displayName, email } : { displayName })
  )
  if (!signedUp.ok) throw new Error('sign-up failed')
  const actor = await authenticate(signedUp.value.token)
  if (!actor.ok) throw new Error('authenticate failed')
  await (await getInjection('IEventRelay')).drain()
  return actor.value.userId
}
