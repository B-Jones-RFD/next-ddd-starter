import type { SessionStarted } from '@/modules/identity/domain/session/session.events'
import type { IntegrationEvent } from '@/shared/kernel/events'

/** `identity.UserSignedIn.v1`: a user started a session, by sign-up or sign-in. */
export type UserSignedInV1 = IntegrationEvent<
  'identity.UserSignedIn',
  { userId: string }
>

export function toUserSignedInV1(event: SessionStarted): UserSignedInV1 {
  return {
    type: 'identity.UserSignedIn',
    version: 1,
    payload: { userId: event.payload.userId },
  }
}
