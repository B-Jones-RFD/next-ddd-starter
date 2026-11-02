import { getInjection } from '@/di/container'
import type { MemberLeftV1 } from '@/modules/boards/application/contracts/member-left.v1'
import type { MemberRemovedV1 } from '@/modules/boards/application/contracts/member-removed.v1'
import { toBoardId } from '@/modules/boards/domain/board/board-id'
import { handOverToOwner } from '@/modules/boards/domain/services/task-assignment.service'
import type { Task } from '@/modules/boards/domain/task/task'
import type { EnvelopeOf } from '@/shared/kernel/events'
import { toUserId } from '@/shared/kernel/user-id'

export const REASSIGN_TO_OWNER = 'boards.reassignToOwner'

/** How often a hand-over reloads a task that changed under it. */
const ATTEMPTS = 3

type Envelope = EnvelopeOf<MemberRemovedV1> | EnvelopeOf<MemberLeftV1>

/**
 * A consequence of a Board member leaving or being removed (§13): every task
 * on the board assigned to them, archived ones included, passes to the
 * board's Owner. Each task is its own transaction, keeping the original
 * `actorId` with the triggering event as `causationId` (§6).
 *
 * It handles the published `boards.MemberRemoved.v1` and `MemberLeft.v1`
 * rather than the domain events, so `causationId` is the id of the event
 * audit records, and Activity can name the removal as the cause.
 *
 * It needs no inbox row: a redelivery finds no task still assigned to them,
 * and someone re-added since keeps their assignments.
 */
export async function reassignToOwner(envelope: Envelope): Promise<void> {
  const userId = toUserId(envelope.payload.userId)
  const boards = await getInjection('IBoardRepository')
  const board = await boards.findById(toBoardId(envelope.payload.boardId))
  if (!board.ok) return
  const tasks = await getInjection('ITaskRepository')
  const origin = { actorId: envelope.actorId, causationId: envelope.id }

  for (const assigned of await tasks.findAssignedTo(board.value.id, userId)) {
    let task: Task = assigned
    for (let attempt = 1; ; attempt += 1) {
      const handed = handOverToOwner(task, board.value, userId)
      if (handed.events.length === 0) break
      const saved = await tasks.save(handed.state, handed.events, origin)
      if (saved.ok) break
      // Someone edited the task meanwhile: hand over from its new state.
      if (attempt === ATTEMPTS) throw saved.error
      const reloaded = await tasks.findById(task.id)
      if (!reloaded.ok) break
      task = reloaded.value
    }
  }
}
