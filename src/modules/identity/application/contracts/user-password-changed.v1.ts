import type { UserPasswordChanged } from '@/modules/identity/domain/user/user.events'
import type { IntegrationEvent } from '@/shared/kernel/events'

/** `identity.UserPasswordChanged.v1`: a user replaced their password. */
export type UserPasswordChangedV1 = IntegrationEvent<
  'identity.UserPasswordChanged',
  { userId: string }
>

export function toUserPasswordChangedV1(
  event: UserPasswordChanged
): UserPasswordChangedV1 {
  return {
    type: 'identity.UserPasswordChanged',
    version: 1,
    payload: { userId: event.payload.userId },
  }
}
