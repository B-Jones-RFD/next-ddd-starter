import { z } from 'zod'

import { getInjection } from '@/di/container'
import type { UserDto } from '@/modules/identity/application/dto/user.dto'
import { parseEmail } from '@/modules/identity/domain/user/email'
import type { NotFoundError } from '@/shared/kernel/errors/app-error'
import { ValidationError } from '@/shared/kernel/errors/domain-error'
import { err, ok, type Result } from '@/shared/kernel/result'
import type { UserId } from '@/shared/kernel/user-id'

const FindUserByEmailInput = z.object({
  actorId: z.string().min(1),
  email: z.string(),
})

/**
 * The registered user with this email, for a signed-in actor. Identity has no
 * membership to filter by: whoever calls it decides who may search, as
 * boards does for Owners. `NotFoundError` if nobody registered it.
 */
export async function findUserByEmail(input: {
  actorId: UserId
  email: string
}): Promise<Result<UserDto, ValidationError | NotFoundError>> {
  const shape = FindUserByEmailInput.safeParse(input)
  if (!shape.success) {
    return err(ValidationError.fromShape(input, shape.error.issues))
  }
  const email = parseEmail(shape.data.email)
  if (!email.ok) return email

  const users = await getInjection('IUserRepository')
  const user = await users.findByEmail(email.value)
  if (!user.ok) return user
  return ok({
    userId: user.value.id,
    displayName: user.value.displayName,
    email: user.value.email,
  })
}
