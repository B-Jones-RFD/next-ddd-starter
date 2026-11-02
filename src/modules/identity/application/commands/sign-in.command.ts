import { z } from 'zod'

import { getInjection } from '@/di/container'
import type { SessionTokenDto } from '@/modules/identity/application/dto/session.dto'
import type { IPasswordHasher } from '@/modules/identity/application/ports/password-hasher.port'
import {
  isSessionActive,
  signOutSession,
  startSession,
  type SessionId,
} from '@/modules/identity/domain/session/session'
import type { Email } from '@/modules/identity/domain/user/email'
import type { Password } from '@/modules/identity/domain/user/password'
import type { PasswordHash } from '@/modules/identity/domain/user/password-hash'
import { rehashUserPassword } from '@/modules/identity/domain/user/user'
import {
  InvalidCredentialsError,
  TooManyAttemptsError,
} from '@/modules/identity/domain/user/user.errors'
import { ValidationError } from '@/shared/kernel/errors/domain-error'
import { err, ok, type Result } from '@/shared/kernel/result'
import type { UserId } from '@/shared/kernel/user-id'

const SignInInput = z.object({
  email: z.string(),
  password: z.string(),
  currentToken: z.string().optional(),
})

export type SignInInput = z.input<typeof SignInInput>

const dummyHashes = new WeakMap<IPasswordHasher, Promise<PasswordHash>>()

/**
 * A hash nobody's password matches, made once per hasher, so an unknown
 * email costs as much as a wrong password (ADR 0009).
 */
function dummyHash(hasher: IPasswordHasher): Promise<PasswordHash> {
  let hash = dummyHashes.get(hasher)
  if (!hash) {
    hash = hasher.hash('dummy password for timing' as Password)
    dummyHashes.set(hasher, hash)
  }
  return hash
}

/**
 * Starts a new session for valid credentials and returns its raw cookie
 * token. A wrong email and a wrong password give the same
 * `InvalidCredentialsError`, and 5 failures per email in 15 minutes block it
 * with `TooManyAttemptsError`. The older session this browser presented, if
 * any, ends as a sign-out. A hash with older parameters is upgraded.
 */
export async function signIn(
  input: SignInInput
): Promise<
  Result<
    SessionTokenDto,
    InvalidCredentialsError | TooManyAttemptsError | ValidationError
  >
> {
  const shape = SignInInput.safeParse(input)
  if (!shape.success) {
    return err(ValidationError.fromShape(input, shape.error.issues))
  }
  // Only presence is checked: format and length rules would tell an
  // attacker something, and change over time.
  const email = shape.data.email.trim().toLowerCase() as Email
  const password = shape.data.password as Password
  const missing = {
    ...(email === '' && { email: 'required' as const }),
    ...(password === '' && { password: 'required' as const }),
  }
  if (Object.keys(missing).length > 0) {
    return err(new ValidationError(missing))
  }

  const now = new Date()
  const throttle = await getInjection('ISignInThrottle')
  if (await throttle.isBlocked(email, now)) {
    return err(new TooManyAttemptsError())
  }

  const users = await getInjection('IUserRepository')
  const hasher = await getInjection('IPasswordHasher')
  const found = await users.findByEmail(email)
  const verified = await hasher.verify(
    password,
    found.ok ? found.value.passwordHash : await dummyHash(hasher)
  )
  if (!found.ok || !verified) {
    await throttle.recordFailure(email, now)
    return err(new InvalidCredentialsError())
  }
  await throttle.clear(email)

  const user = found.value
  const origin = { actorId: user.id, causationId: null }
  if (hasher.needsRehash(user.passwordHash)) {
    const rehashed = rehashUserPassword(user, await hasher.hash(password))
    // A conflict means the user just changed; the next sign-in rehashes.
    await users.save(rehashed.state, rehashed.events, origin)
  }

  if (shape.data.currentToken) {
    await signOutPresented(shape.data.currentToken, user.id, now)
  }

  const tokens = await getInjection('ITokenGenerator')
  const ids = await getInjection('IIdGenerator')
  const { token, hash } = tokens.generate()
  const session = startSession({
    id: ids.next() as SessionId,
    userId: user.id,
    tokenHash: hash,
    now,
  })
  const sessions = await getInjection('ISessionRepository')
  const saved = await sessions.save(session.state, session.events, origin)
  if (!saved.ok) throw saved.error

  return ok({ token })
}

/** Ends the session the browser still held, as a sign-out of it. */
async function signOutPresented(
  token: string,
  actorId: UserId,
  now: Date
): Promise<void> {
  const tokens = await getInjection('ITokenGenerator')
  const sessions = await getInjection('ISessionRepository')
  const presented = await sessions.findByTokenHash(tokens.hash(token))
  if (!presented.ok || !isSessionActive(presented.value, now)) return
  const ended = signOutSession(presented.value, { now, everywhere: false })
  // A conflict means it just ended some other way.
  await sessions.save(ended.state, ended.events, {
    actorId,
    causationId: null,
  })
}
