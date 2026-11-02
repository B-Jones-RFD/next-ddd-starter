import { z } from 'zod'

import { getInjection } from '@/di/container'
import type { ActorDto } from '@/modules/identity/application/dto/session.dto'
import { SESSION_TOUCH_INTERVAL_MS } from '@/modules/identity/domain/session/session'
import { UnauthenticatedError } from '@/shared/kernel/errors/app-error'
import { err, ok, type Result } from '@/shared/kernel/result'

const Token = z.string().min(1)

/**
 * Who the session with this raw cookie token belongs to (§9). Takes the
 * token instead of an actor, like identity's other session use cases. An
 * unknown, ended or expired session is `UnauthenticatedError`.
 *
 * It records the session's use at most once a minute, straight through the
 * repository with no events: the one write a query makes (§13).
 */
// #region authenticate
export async function authenticate(
  token: string
): Promise<Result<ActorDto, UnauthenticatedError>> {
  const shape = Token.safeParse(token)
  if (!shape.success) return err(new UnauthenticatedError())

  const now = new Date()
  const tokens = await getInjection('ITokenGenerator')
  const users = await getInjection('IUserReader')
  const signedIn = await users.findSignedIn(tokens.hash(shape.data), now)
  if (!signedIn) return err(new UnauthenticatedError())

  const sinceSeen = now.getTime() - Date.parse(signedIn.lastSeenAt)
  if (sinceSeen >= SESSION_TOUCH_INTERVAL_MS) {
    const sessions = await getInjection('ISessionRepository')
    await sessions.touch(signedIn.sessionId, now)
  }
  return ok(signedIn.actor)
}
// #endregion authenticate
