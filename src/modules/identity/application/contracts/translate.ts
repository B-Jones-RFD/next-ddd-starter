import { toUserPasswordChangedV1 } from '@/modules/identity/application/contracts/user-password-changed.v1'
import { toUserRegisteredV1 } from '@/modules/identity/application/contracts/user-registered.v1'
import { toUserRenamedV1 } from '@/modules/identity/application/contracts/user-renamed.v1'
import { toUserSignedInV1 } from '@/modules/identity/application/contracts/user-signed-in.v1'
import { toUserSignedOutV1 } from '@/modules/identity/application/contracts/user-signed-out.v1'
import type { SessionEvent } from '@/modules/identity/domain/session/session.events'
import type { UserEvent } from '@/modules/identity/domain/user/user.events'
import type { IntegrationEvent } from '@/shared/kernel/events'

/** The published translations of a user's domain events (§6). */
export function translateUserEvents(
  events: readonly UserEvent[]
): IntegrationEvent[] {
  return events.map((event) => {
    switch (event.type) {
      case 'UserRegistered':
        return toUserRegisteredV1(event)
      case 'UserRenamed':
        return toUserRenamedV1(event)
      case 'UserPasswordChanged':
        return toUserPasswordChangedV1(event)
    }
  })
}

/**
 * The published translations of a session's domain events. A session ended
 * as a consequence isn't published: the sign-out or password change is.
 */
export function translateSessionEvents(
  events: readonly SessionEvent[]
): IntegrationEvent[] {
  return events.flatMap((event): IntegrationEvent[] => {
    switch (event.type) {
      case 'SessionStarted':
        return [toUserSignedInV1(event)]
      case 'SessionSignedOut':
        return [toUserSignedOutV1(event)]
      case 'SessionEnded':
        return []
    }
  })
}
