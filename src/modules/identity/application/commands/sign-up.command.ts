import { z } from 'zod'

import { getInjection } from '@/di/container'
import type { SessionTokenDto } from '@/modules/identity/application/dto/session.dto'
import {
  startSession,
  type SessionId,
} from '@/modules/identity/domain/session/session'
import {
  parseRegistration,
  registerUser,
} from '@/modules/identity/domain/user/user'
import { EmailTakenError } from '@/modules/identity/domain/user/user.errors'
import { ValidationError } from '@/shared/kernel/errors/domain-error'
import { err, ok, type Result } from '@/shared/kernel/result'
import { toUserId } from '@/shared/kernel/user-id'

const SignUpInput = z.object({
  displayName: z.string(),
  email: z.string(),
  password: z.string(),
})

export type SignUpInput = z.input<typeof SignUpInput>

/**
 * Registers a user and starts their first session: two aggregates, saved one
 * after the other (§4). Returns the session's raw cookie token.
 */
export async function signUp(
  input: SignUpInput
): Promise<Result<SessionTokenDto, EmailTakenError | ValidationError>> {
  const shape = SignUpInput.safeParse(input)
  if (!shape.success) {
    return err(ValidationError.fromShape(input, shape.error.issues))
  }
  const registration = parseRegistration(shape.data)
  if (!registration.ok) return registration
  const { displayName, email, password } = registration.value

  const users = await getInjection('IUserRepository')
  if ((await users.findByEmail(email)).ok) return err(new EmailTakenError())

  const hasher = await getInjection('IPasswordHasher')
  const ids = await getInjection('IIdGenerator')
  const userId = toUserId(ids.next())
  const user = registerUser({
    id: userId,
    displayName,
    email,
    passwordHash: await hasher.hash(password),
    now: new Date(),
  })
  const origin = { actorId: userId, causationId: null }
  // A new user can only conflict on its email, taken since the check above.
  const savedUser = await users.save(user.state, user.events, origin)
  if (!savedUser.ok) return err(new EmailTakenError())

  const tokens = await getInjection('ITokenGenerator')
  const { token, hash } = tokens.generate()
  const session = startSession({
    id: ids.next() as SessionId,
    userId,
    tokenHash: hash,
    now: new Date(),
  })
  const sessions = await getInjection('ISessionRepository')
  const savedSession = await sessions.save(
    session.state,
    session.events,
    origin
  )
  if (!savedSession.ok) throw savedSession.error

  return ok({ token })
}
