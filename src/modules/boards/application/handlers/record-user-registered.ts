import { getInjection } from '@/di/container'
import type { UserRegisteredV1 } from '@/modules/identity/contracts'
import type { EnvelopeOf } from '@/shared/kernel/events'
import { toUserId } from '@/shared/kernel/user-id'

export const RECORD_USER_REGISTERED = 'boards.recordUserRegistered'

/** Records a new user's display name in boards' people projection. */
export async function recordUserRegistered(
  envelope: EnvelopeOf<UserRegisteredV1>
): Promise<void> {
  const people = await getInjection('IPeopleProjection')
  await people.record(
    {
      userId: toUserId(envelope.payload.userId),
      displayName: envelope.payload.displayName,
    },
    envelope.aggregateVersion,
    { eventId: envelope.id, handler: RECORD_USER_REGISTERED }
  )
}
