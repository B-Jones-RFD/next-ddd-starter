import { z } from 'zod'

import { getInjection } from '@/di/container'
import type { ActorDto } from '@/modules/identity/application/dto/session.dto'
import { UnauthenticatedError } from '@/shared/kernel/errors/app-error'
import { err, ok, type Result } from '@/shared/kernel/result'

const Token = z.string().min(1)

/**
 * Who the session with this raw cookie token belongs to (§9). Takes the
 * token instead of an actor, like identity's other session use cases.
 */
// #region authenticate
export async function authenticate(
  token: string
): Promise<Result<ActorDto, UnauthenticatedError>> {
  const shape = Token.safeParse(token)
  if (!shape.success) return err(new UnauthenticatedError())

  const tokens = await getInjection('ITokenGenerator')
  const sessions = await getInjection('ISessionRepository')
  const session = await sessions.findByTokenHash(tokens.hash(shape.data))
  if (!session.ok) return err(new UnauthenticatedError())

  const users = await getInjection('IUserRepository')
  const user = await users.findById(session.value.userId)
  if (!user.ok) return err(new UnauthenticatedError())

  return ok({ userId: user.value.id, displayName: user.value.displayName })
}
// #endregion authenticate
