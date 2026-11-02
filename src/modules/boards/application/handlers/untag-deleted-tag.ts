import { getInjection } from '@/di/container'
import type { TagDeletedV1 } from '@/modules/boards/application/contracts/tag-deleted.v1'
import { changeEachTask } from '@/modules/boards/application/handlers/change-each-task'
import { toTagId } from '@/modules/boards/domain/board/tag'
import { detachTag } from '@/modules/boards/domain/task/task'
import type { EnvelopeOf } from '@/shared/kernel/events'

export const UNTAG_DELETED_TAG = 'boards.untagDeletedTag'

/**
 * The Consequence of a deleted tag: strips it from every task that had it,
 * archived ones included. Each task is its own transaction, written with the
 * user who deleted the tag as `actorId` and the event as `causationId` (§6).
 * It handles the published `boards.TagDeleted.v1` rather than the domain
 * event, so `causationId` is the id of the event audit records, and
 * Activity can name the deletion as the cause.
 *
 * It writes no inbox row (§13): it is idempotent by state instead, because
 * one event writes many tasks, and a redelivery after a partial failure must
 * still reach the rest. A task that no longer carries the tag is skipped,
 * and one that keeps changing under it is left for that redelivery.
 */
export async function untagDeletedTag(
  envelope: EnvelopeOf<TagDeletedV1>
): Promise<void> {
  const tasks = await getInjection('ITaskRepository')
  const tagId = toTagId(envelope.payload.tagId)
  await changeEachTask(
    await tasks.findTaggedWith(tagId),
    (task) => detachTag(task, tagId),
    { actorId: envelope.actorId, causationId: envelope.id }
  )
}
