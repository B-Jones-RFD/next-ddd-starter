import { z } from 'zod'

import { getInjection } from '@/di/container'
import type { TagDto } from '@/modules/boards/application/dto/tag.dto'
import type { NotFoundError } from '@/shared/kernel/errors/app-error'
import {
  type ForbiddenError,
  ValidationError,
} from '@/shared/kernel/errors/domain-error'
import { err, type Result } from '@/shared/kernel/result'
import type { UserId } from '@/shared/kernel/user-id'

const ListTagsInput = z.object({
  actorId: z.string().min(1),
  boardId: z.string().min(1),
})

/**
 * A board's tags by name, for a Board member of it: for its Tags settings
 * and the task dialog's picker. `ForbiddenError` for anyone else, and
 * `NotFoundError` if there is no such board.
 */
export async function listTags(input: {
  actorId: UserId
  boardId: string
}): Promise<
  Result<TagDto[], ValidationError | NotFoundError | ForbiddenError>
> {
  const shape = ListTagsInput.safeParse(input)
  if (!shape.success) {
    return err(ValidationError.fromShape(input, shape.error.issues))
  }
  const boards = await getInjection('IBoardReader')
  return boards.tagsForMember(shape.data.boardId, input.actorId)
}
