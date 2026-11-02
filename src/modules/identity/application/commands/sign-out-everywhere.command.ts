import { z } from 'zod'

import { getInjection } from '@/di/container'
import {
  endSession,
  isSessionActive,
  signOutSession,
} from '@/modules/identity/domain/session/session'
import { UnauthenticatedError } from '@/shared/kernel/errors/app-error'
import { err, ok, type Result } from '@/shared/kernel/result'

const Token = z.string().min(1)

/**
 * Ends every session of the user this raw cookie token signs in, this one
 * included. One aggregate per transaction: this session is signed out
 * everywhere, then each other session ends as a consequence (§4).
 */
export async function signOutEverywhere(
  token: string
): Promise<Result<void, UnauthenticatedError>> {
  const shape = Token.safeParse(token)
  if (!shape.success) return err(new UnauthenticatedError())

  const now = new Date()
  const tokens = await getInjection('ITokenGenerator')
  const sessions = await getInjection('ISessionRepository')
  const found = await sessions.findByTokenHash(tokens.hash(shape.data))
  if (!found.ok || !isSessionActive(found.value, now)) {
    return err(new UnauthenticatedError())
  }
  const current = found.value
  const origin = { actorId: current.userId, causationId: null }

  const signedOut = signOutSession(current, { now, everywhere: true })
  const saved = await sessions.save(signedOut.state, signedOut.events, origin)
  // It ended some other way meanwhile: this request no longer signs anyone in.
  if (!saved.ok) return err(new UnauthenticatedError())

  for (const other of await sessions.findByUserId(current.userId)) {
    if (other.id === current.id) continue
    const ended = endSession(other, { now, reason: 'signed-out-everywhere' })
    if (ended.events.length === 0) continue
    // A conflict means that session just ended some other way.
    await sessions.save(ended.state, ended.events, origin)
  }
  return ok(undefined)
}
