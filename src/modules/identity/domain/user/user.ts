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
import { ValidationError } from '@/shared/kernel/errors/domain-error'
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
