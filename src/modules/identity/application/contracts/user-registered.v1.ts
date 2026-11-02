import type { UserRegistered } from '@/modules/identity/domain/user/user.events'
import type { IntegrationEvent } from '@/shared/kernel/events'

/** `identity.UserRegistered.v1`: a new user, and the name to show them by. */
export type UserRegisteredV1 = IntegrationEvent<
  'identity.UserRegistered',
  { userId: string; displayName: string }
>

export function toUserRegisteredV1(event: UserRegistered): UserRegisteredV1 {
  return {
    type: 'identity.UserRegistered',
    version: 1,
    payload: {
      userId: event.payload.userId,
      displayName: event.payload.displayName,
    },
  }
}
