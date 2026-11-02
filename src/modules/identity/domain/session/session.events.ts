import type { DomainEvent } from '@/shared/kernel/events'
import type { UserId } from '@/shared/kernel/user-id'

/** A user started a session. Not published yet. */
export type SessionStarted = DomainEvent<'SessionStarted', { userId: UserId }>

export type SessionEvent = SessionStarted
