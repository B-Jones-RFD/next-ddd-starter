import { z } from 'zod'

import { getInjection } from '@/di/container'
import { signOutSession } from '@/modules/identity/domain/session/session'
import { ok, type Result } from '@/shared/kernel/result'

const Token = z.string()

/**
 * Ends the session with this raw cookie token. Takes the token instead of
 * an actor (§9). Signing out of a session that already ended, or never
 * existed, succeeds too: the browser is signed out either way.
 */
export async function signOut(token: string): Promise<Result<void, never>> {
  const shape = Token.safeParse(token)
  if (!shape.success || shape.data === '') return ok(undefined)

  const tokens = await getInjection('ITokenGenerator')
  const sessions = await getInjection('ISessionRepository')
  const found = await sessions.findByTokenHash(tokens.hash(shape.data))
  if (!found.ok) return ok(undefined)

  const { state, events } = signOutSession(found.value, {
    now: new Date(),
    everywhere: false,
  })
  if (events.length === 0) return ok(undefined)
  // A conflict means it just ended some other way, which is the same result.
  await sessions.save(state, events, {
    actorId: state.userId,
    causationId: null,
  })
  return ok(undefined)
}
