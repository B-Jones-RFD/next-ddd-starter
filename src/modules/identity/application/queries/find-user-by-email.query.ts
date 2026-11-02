import { z } from 'zod'

import { getInjection } from '@/di/container'
import type { UserDto } from '@/modules/identity/application/dto/user.dto'
import type { NotFoundError } from '@/shared/kernel/errors/app-error'
import {
  type ForbiddenError,
  ValidationError,
} from '@/shared/kernel/errors/domain-error'
import { err, type Result } from '@/shared/kernel/result'
import type { UserId } from '@/shared/kernel/user-id'

const FindUserByEmailInput = z.object({
  actorId: z.string().min(1),
  // Emails are stored trimmed and lowercased, so compare them that way.
  email: z.string().trim().toLowerCase().pipe(z.email()),
})

/**
 * The registered user with this email, for an actor who is a registered user
 * themself: in identity, that is all membership means. `ForbiddenError` for
 * anyone else, and `NotFoundError` if nobody registered the email. Whoever
 * calls it decides who else may search, as boards does for Owners.
 */
export async function findUserByEmail(input: {
  actorId: UserId
  email: string
}): Promise<Result<UserDto, ValidationError | ForbiddenError | NotFoundError>> {
  const shape = FindUserByEmailInput.safeParse(input)
  if (!shape.success) {
    return err(ValidationError.fromShape(input, shape.error.issues))
  }

  const users = await getInjection('IUserReader')
  return users.findByEmail(input.actorId, shape.data.email)
}
