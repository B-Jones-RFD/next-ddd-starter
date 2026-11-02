import type { UserRenamed } from '@/modules/identity/domain/user/user.events'
import type { IntegrationEvent } from '@/shared/kernel/events'

/** `identity.UserRenamed.v1`: a user's display name changed `from` → `to`. */
export type UserRenamedV1 = IntegrationEvent<
  'identity.UserRenamed',
  { userId: string; from: string; to: string }
>

export function toUserRenamedV1(event: UserRenamed): UserRenamedV1 {
  return {
    type: 'identity.UserRenamed',
    version: 1,
    payload: {
      userId: event.payload.userId,
      from: event.payload.from,
      to: event.payload.to,
    },
  }
}
