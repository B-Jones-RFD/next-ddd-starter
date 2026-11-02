import {
  parseDisplayName,
  type DisplayName,
} from '@/modules/identity/domain/user/display-name'
import { parseEmail, type Email } from '@/modules/identity/domain/user/email'
import {
  parsePassword,
  type Password,
} from '@/modules/identity/domain/user/password'
import type { PasswordHash } from '@/modules/identity/domain/user/password-hash'
import type { UserEvent } from '@/modules/identity/domain/user/user.events'
import {
  ForbiddenError,
  ValidationError,
} from '@/shared/kernel/errors/domain-error'
import { err, ok, type Result } from '@/shared/kernel/result'
import type { UserId } from '@/shared/kernel/user-id'

/** A person with an account who can sign in. */
export type User = {
  readonly id: UserId
  readonly displayName: DisplayName
  readonly email: Email
  readonly passwordHash: PasswordHash
  readonly createdAt: Date
  /** Owned by persistence: 0 until first saved (§5). */
  readonly version: number
}

export type Registration = {
  readonly displayName: DisplayName
  readonly email: Email
  readonly password: Password
}

/** Parses sign-up fields, reporting every invalid one at once. */
export function parseRegistration(input: {
  displayName: string
  email: string
  password: string
}): Result<Registration, ValidationError> {
  const displayName = parseDisplayName(input.displayName)
  const email = parseEmail(input.email)
  const password = parsePassword(input.password)

  if (displayName.ok && email.ok && password.ok) {
    return ok({
      displayName: displayName.value,
      email: email.value,
      password: password.value,
    })
  }
  return err(
    ValidationError.merge(
      [displayName, email, password].flatMap((r) => (r.ok ? [] : [r.error]))
    )
  )
}

/**
 * Registers a new user. Whether the email is free is checked by the caller
 * against the repository, and the password is hashed before this runs.
 */
export function registerUser(input: {
  id: UserId
  displayName: DisplayName
  email: Email
  passwordHash: PasswordHash
  now: Date
}): { state: User; events: UserEvent[] } {
  const state: User = {
    id: input.id,
    displayName: input.displayName,
    email: input.email,
    passwordHash: input.passwordHash,
    createdAt: input.now,
    version: 0,
  }
  return {
    state,
    events: [
      {
        type: 'UserRegistered',
        payload: { userId: input.id, displayName: input.displayName },
      },
    ],
  }
}

type Change = { state: User; events: UserEvent[] }

// #region rename-user
/** The user changes their own display name. The same name raises nothing. */
export function renameUser(
  user: User,
  actorId: UserId,
  rawDisplayName: string
): Result<Change, ValidationError | ForbiddenError> {
  if (actorId !== user.id) return err(new ForbiddenError())
  const displayName = parseDisplayName(rawDisplayName)
  if (!displayName.ok) return displayName
  if (displayName.value === user.displayName) {
    return ok({ state: user, events: [] })
  }
  return ok({
    state: { ...user, displayName: displayName.value },
    events: [
      {
        type: 'UserRenamed',
        payload: {
          userId: user.id,
          from: user.displayName,
          to: displayName.value,
        },
      },
    ],
  })
}
// #endregion rename-user

/**
 * The user replaces their password. The caller has checked the current one
 * and hashed the new one.
 */
export function changeUserPassword(
  user: User,
  actorId: UserId,
  passwordHash: PasswordHash
): Result<Change, ForbiddenError> {
  if (actorId !== user.id) return err(new ForbiddenError())
  return ok({
    state: { ...user, passwordHash },
    events: [{ type: 'UserPasswordChanged', payload: { userId: user.id } }],
  })
}

/**
 * Stores a stronger hash of the same password at sign-in (ADR 0009). The
 * password didn't change, so nothing is raised.
 */
export function rehashUserPassword(
  user: User,
  passwordHash: PasswordHash
): Change {
  return { state: { ...user, passwordHash }, events: [] }
}
