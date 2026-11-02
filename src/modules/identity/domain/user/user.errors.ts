import { DomainError } from '@/shared/kernel/errors/domain-error'

/** Another user already registered this email. */
export class EmailTakenError extends DomainError {
  readonly code = 'identity.email-taken'

  constructor() {
    super('Email is already registered')
  }
}

/**
 * The email or the password is wrong. One error for both, so a sign-in never
 * reveals which emails are registered.
 */
export class InvalidCredentialsError extends DomainError {
  readonly code = 'identity.invalid-credentials'

  constructor() {
    super('Invalid credentials')
  }
}

/** Too many failed sign-ins for this email lately (ADR 0009). */
export class TooManyAttemptsError extends DomainError {
  readonly code = 'identity.too-many-attempts'

  constructor() {
    super('Too many failed sign-in attempts')
  }
}

/** A password change gave the wrong current password. */
export class IncorrectPasswordError extends DomainError {
  readonly code = 'identity.incorrect-password'

  constructor() {
    super('Current password is incorrect')
  }
}
