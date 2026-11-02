import { toUserRegisteredV1 } from '@/modules/identity/application/contracts/user-registered.v1'
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
    }
  })
}

/** Session events aren't published yet. */
export function translateSessionEvents(
  events: readonly SessionEvent[]
): IntegrationEvent[] {
  return events.flatMap((event) => {
    switch (event.type) {
      case 'SessionStarted':
        return []
    }
  })
}
