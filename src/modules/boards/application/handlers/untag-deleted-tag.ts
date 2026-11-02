import { getInjection } from '@/di/container'
import type { TagDeletedV1 } from '@/modules/boards/application/contracts/tag-deleted.v1'
import { toTagId, type TagId } from '@/modules/boards/domain/board/tag'
import { detachTag, type Task } from '@/modules/boards/domain/task/task'
import type { ITaskRepository } from '@/modules/boards/domain/task/task-repository.port'
import type { EnvelopeOf, EventEnvelope } from '@/shared/kernel/events'

export const UNTAG_DELETED_TAG = 'boards.untagDeletedTag'

/** Tries per task before giving up on a task that keeps changing. */
const ATTEMPTS = 3

/**
 * The Consequence of a deleted tag: strips it from every task that had it,
 * archived ones included. Each task is its own transaction, written with the
 * user who deleted the tag as `actorId` and the event as `causationId` (§6).
 * It handles the published `boards.TagDeleted.v1` rather than the domain
 * event, so `causationId` is the id of the event audit records, and
 * Activity can name the deletion as the cause.
 *
 * It is idempotent by state, which stands in for an inbox row here: one
 * event writes many tasks, and a redelivery after a partial failure must
 * still reach the rest. A task that no longer carries the tag is skipped.
 */
export async function untagDeletedTag(
  envelope: EnvelopeOf<TagDeletedV1>
): Promise<void> {
  const tasks = await getInjection('ITaskRepository')
  const tagId = toTagId(envelope.payload.tagId)
  const origin = { actorId: envelope.actorId, causationId: envelope.id }
  for (const task of await tasks.findTaggedWith(tagId)) {
    await untag(tasks, task, tagId, origin)
  }
}

async function untag(
  tasks: ITaskRepository,
  loaded: Task,
  tagId: TagId,
  origin: { actorId: EventEnvelope['actorId']; causationId: string }
): Promise<void> {
  let task = loaded
  for (let attempt = 1; ; attempt += 1) {
    const detached = detachTag(task, tagId)
    if (detached.events.length === 0) return
    const saved = await tasks.save(detached.state, detached.events, origin)
    if (saved.ok) return
    // Someone edited the task meanwhile: reload it and try again.
    if (attempt === ATTEMPTS) throw saved.error
    const reloaded = await tasks.findById(task.id)
    if (!reloaded.ok) return
    task = reloaded.value
  }
}
