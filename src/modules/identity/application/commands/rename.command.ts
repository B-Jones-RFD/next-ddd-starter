import { z } from 'zod'

import { getInjection } from '@/di/container'
import { renameUser } from '@/modules/identity/domain/user/user'
import type { ConflictError } from '@/shared/kernel/errors/app-error'
import {
  ForbiddenError,
  ValidationError,
} from '@/shared/kernel/errors/domain-error'
import { err, ok, type Result } from '@/shared/kernel/result'
import type { UserId } from '@/shared/kernel/user-id'

const RenameInput = z.object({
  actorId: z.string().min(1),
  displayName: z.string(),
})

export type RenameInput = { actorId: UserId; displayName: string }

/** Changes the actor's display name. Boards learns it from `UserRenamed.v1`. */
export async function rename(
  input: RenameInput
): Promise<Result<void, ValidationError | ForbiddenError | ConflictError>> {
  const shape = RenameInput.safeParse(input)
  if (!shape.success) {
    return err(ValidationError.fromShape(input, shape.error.issues))
  }

  const users = await getInjection('IUserRepository')
  const user = await users.findById(input.actorId)
  // Only a user may rename themselves, and nobody else is a user.
  if (!user.ok) return err(new ForbiddenError())

  const renamed = renameUser(user.value, input.actorId, shape.data.displayName)
  if (!renamed.ok) return renamed
  if (renamed.value.events.length === 0) return ok(undefined)

  const saved = await users.save(renamed.value.state, renamed.value.events, {
    actorId: input.actorId,
    causationId: null,
  })
  return saved.ok ? ok(undefined) : saved
}
