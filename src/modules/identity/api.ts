import 'server-only'

import { signUp as signUpCommand } from '@/modules/identity/application/commands/sign-up.command'
import { authenticate as authenticateQuery } from '@/modules/identity/application/queries/authenticate.query'
import { traced } from '@/shared/infrastructure/tracing'

// Public API of the identity context (§2): its commands and queries, each
// wrapped in `traced`, plus their DTO types and the errors they return.

// #region use-cases
export const signUp = traced('identity.signUp', signUpCommand)
export const authenticate = traced('identity.authenticate', authenticateQuery)
// #endregion use-cases

export type { SignUpInput } from '@/modules/identity/application/commands/sign-up.command'
export type {
  ActorDto,
  SessionTokenDto,
} from '@/modules/identity/application/dto/session.dto'
// #region errors
export { EmailTakenError } from '@/modules/identity/domain/user/user.errors'
export { UnauthenticatedError } from '@/shared/kernel/errors/app-error'
export { ValidationError } from '@/shared/kernel/errors/domain-error'
// #endregion errors
