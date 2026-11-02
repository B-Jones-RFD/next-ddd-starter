import { getInjection } from '@/di/container'
import type { UserRenamedV1 } from '@/modules/identity/contracts'
import type { EnvelopeOf } from '@/shared/kernel/events'
import { toUserId } from '@/shared/kernel/user-id'

export const RECORD_USER_RENAMED = 'boards.recordUserRenamed'

/** Records a user's new display name in boards' people projection. */
export async function recordUserRenamed(
  envelope: EnvelopeOf<UserRenamedV1>
): Promise<void> {
  const people = await getInjection('IPeopleProjection')
  await people.record(
    {
      userId: toUserId(envelope.payload.userId),
      displayName: envelope.payload.to,
    },
    envelope.aggregateVersion,
    { eventId: envelope.id, handler: RECORD_USER_RENAMED }
  )
}
