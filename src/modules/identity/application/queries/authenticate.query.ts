import { z } from 'zod'

import { getInjection } from '@/di/container'
import type { ActorDto } from '@/modules/identity/application/dto/session.dto'
import {
  isSessionActive,
  isTouchDue,
  touchSession,
} from '@/modules/identity/domain/session/session'
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
export async function authenticate(
  token: string
): Promise<Result<ActorDto, UnauthenticatedError>> {
  const shape = Token.safeParse(token)
  if (!shape.success) return err(new UnauthenticatedError())

  const now = new Date()
  const tokens = await getInjection('ITokenGenerator')
  const sessions = await getInjection('ISessionRepository')
  const found = await sessions.findByTokenHash(tokens.hash(shape.data))
  if (!found.ok || !isSessionActive(found.value, now)) {
    return err(new UnauthenticatedError())
  }
  const session = found.value

  const users = await getInjection('IUserRepository')
  const user = await users.findById(session.userId)
  if (!user.ok) return err(new UnauthenticatedError())

  if (isTouchDue(session, now)) {
    await sessions.touch(session.id, touchSession(session, now).lastSeenAt)
  }
  return ok({ userId: user.value.id, displayName: user.value.displayName })
}
