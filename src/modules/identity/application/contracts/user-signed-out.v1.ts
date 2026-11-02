import type { SessionSignedOut } from '@/modules/identity/domain/session/session.events'
import type { IntegrationEvent } from '@/shared/kernel/events'

/**
 * `identity.UserSignedOut.v1`: a user signed out, of one session or, with
 * `everywhere`, of all of them.
 */
export type UserSignedOutV1 = IntegrationEvent<
  'identity.UserSignedOut',
  { userId: string; everywhere: boolean }
>

export function toUserSignedOutV1(event: SessionSignedOut): UserSignedOutV1 {
  return {
    type: 'identity.UserSignedOut',
    version: 1,
    payload: {
      userId: event.payload.userId,
      everywhere: event.payload.everywhere,
    },
  }
}
