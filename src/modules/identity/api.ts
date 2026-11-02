import 'server-only'

import { changePassword as changePasswordCommand } from '@/modules/identity/application/commands/change-password.command'
import { rename as renameCommand } from '@/modules/identity/application/commands/rename.command'
import { signIn as signInCommand } from '@/modules/identity/application/commands/sign-in.command'
import { signOutEverywhere as signOutEverywhereCommand } from '@/modules/identity/application/commands/sign-out-everywhere.command'
import { signOut as signOutCommand } from '@/modules/identity/application/commands/sign-out.command'
import { signUp as signUpCommand } from '@/modules/identity/application/commands/sign-up.command'
import { authenticate as authenticateQuery } from '@/modules/identity/application/queries/authenticate.query'
import { findUserByEmail as findUserByEmailQuery } from '@/modules/identity/application/queries/find-user-by-email.query'
import { traced } from '@/shared/infrastructure/tracing'

// Public API of the identity context (§2): its commands and queries, each
// wrapped in `traced`, plus their DTO types and the errors they return.

// #region use-cases
export const signUp = traced('identity.signUp', signUpCommand)
export const signIn = traced('identity.signIn', signInCommand)
export const signOut = traced('identity.signOut', signOutCommand)
export const signOutEverywhere = traced(
  'identity.signOutEverywhere',
  signOutEverywhereCommand
)
export const changePassword = traced(
  'identity.changePassword',
  changePasswordCommand
)
export const rename = traced('identity.rename', renameCommand)
export const authenticate = traced('identity.authenticate', authenticateQuery)
export const findUserByEmail = traced(
  'identity.findUserByEmail',
  findUserByEmailQuery
)
// #endregion use-cases

export type { ChangePasswordInput } from '@/modules/identity/application/commands/change-password.command'
export type { RenameInput } from '@/modules/identity/application/commands/rename.command'
export type { SignInInput } from '@/modules/identity/application/commands/sign-in.command'
export type { SignUpInput } from '@/modules/identity/application/commands/sign-up.command'
export type {
  ActorDto,
  SessionTokenDto,
} from '@/modules/identity/application/dto/session.dto'
export type { UserDto } from '@/modules/identity/application/dto/user.dto'
// #region errors
export {
  EmailTakenError,
  IncorrectPasswordError,
  InvalidCredentialsError,
  TooManyAttemptsError,
} from '@/modules/identity/domain/user/user.errors'
export {
  ConflictError,
  NotFoundError,
  UnauthenticatedError,
} from '@/shared/kernel/errors/app-error'
export {
  ForbiddenError,
  ValidationError,
} from '@/shared/kernel/errors/domain-error'
// #endregion errors
