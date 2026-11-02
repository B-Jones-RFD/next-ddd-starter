import { z } from 'zod'

import { getInjection } from '@/di/container'
import {
  endSession,
  isSessionActive,
} from '@/modules/identity/domain/session/session'
import {
  parsePassword,
  type Password,
} from '@/modules/identity/domain/user/password'
import { changeUserPassword } from '@/modules/identity/domain/user/user'
import { IncorrectPasswordError } from '@/modules/identity/domain/user/user.errors'
import type { ConflictError } from '@/shared/kernel/errors/app-error'
import { UnauthenticatedError } from '@/shared/kernel/errors/app-error'
import type { ForbiddenError } from '@/shared/kernel/errors/domain-error'
import {
  ValidationError,
  type FieldIssue,
} from '@/shared/kernel/errors/domain-error'
import { err, ok, type Result } from '@/shared/kernel/result'
import type { UserId } from '@/shared/kernel/user-id'

const ChangePasswordInput = z.object({
  actorId: z.string().min(1),
  token: z.string(),
  currentPassword: z.string(),
  newPassword: z.string(),
})

export type ChangePasswordInput = Omit<
  z.input<typeof ChangePasswordInput>,
  'actorId'
> & { actorId: UserId }

/**
 * Replaces the actor's password after checking the current one. Every other
 * session of theirs ends, and the one `token` signs in stays (ADR 0009).
 */
export async function changePassword(
  input: ChangePasswordInput
): Promise<
  Result<
    void,
    | IncorrectPasswordError
    | ValidationError
    | UnauthenticatedError
    | ForbiddenError
    | ConflictError
  >
> {
  const shape = ChangePasswordInput.safeParse(input)
  if (!shape.success) {
    return err(ValidationError.fromShape(input, shape.error.issues))
  }
  const { token, currentPassword } = shape.data
  const issues: Record<string, FieldIssue> = {}
  if (currentPassword === '') issues.currentPassword = 'required'
  const newPassword = parsePassword(shape.data.newPassword)
  if (!newPassword.ok) {
    const issue = newPassword.error.fields.password
    if (issue) issues.newPassword = issue
  }
  if (!newPassword.ok || Object.keys(issues).length > 0) {
    return err(new ValidationError(issues))
  }

  const now = new Date()
  const tokens = await getInjection('ITokenGenerator')
  const sessions = await getInjection('ISessionRepository')
  const current = await sessions.findByTokenHash(tokens.hash(token))
  if (
    !current.ok ||
    !isSessionActive(current.value, now) ||
    current.value.userId !== input.actorId
  ) {
    return err(new UnauthenticatedError())
  }

  const users = await getInjection('IUserRepository')
  const user = await users.findById(input.actorId)
  if (!user.ok) return err(new UnauthenticatedError())

  const hasher = await getInjection('IPasswordHasher')
  if (
    !(await hasher.verify(currentPassword as Password, user.value.passwordHash))
  ) {
    return err(new IncorrectPasswordError())
  }

  const changed = changeUserPassword(
    user.value,
    input.actorId,
    await hasher.hash(newPassword.value)
  )
  if (!changed.ok) return changed
  const origin = { actorId: input.actorId, causationId: null }
  const saved = await users.save(
    changed.value.state,
    changed.value.events,
    origin
  )
  if (!saved.ok) return saved

  for (const other of await sessions.findByUserId(input.actorId)) {
    if (other.id === current.value.id) continue
    const ended = endSession(other, { now, reason: 'password-changed' })
    if (ended.events.length === 0) continue
    // A conflict means that session just ended some other way.
    await sessions.save(ended.state, ended.events, origin)
  }
  return ok(undefined)
}
