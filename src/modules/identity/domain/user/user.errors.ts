import { DomainError } from '@/shared/kernel/errors/domain-error'

/** Another user already registered this email. */
export class EmailTakenError extends DomainError {
  readonly code = 'identity.email-taken'

  constructor() {
    super('Email is already registered')
  }
}
