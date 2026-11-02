import type { NotFoundError } from '@/shared/kernel/errors/app-error'
import type { Result } from '@/shared/kernel/result'
import type { UserId } from '@/shared/kernel/user-id'

/** A user as boards knows them, learned from identity's events. */
export type Person = {
  readonly userId: UserId
  readonly displayName: string
}

/** Which handler applied which event, for the inbox. */
export type Receipt = {
  readonly eventId: string
  readonly handler: string
}

/**
 * Boards' copy of each user's display name (`boards_people`), kept by event
 * handlers so boards never asks identity on a read. Throws
 * `PersistenceError` on an outage.
 */
export interface IPeopleProjection {
  /**
   * Records `person` at `aggregateVersion`, with the inbox row for
   * `receipt`, in one transaction. A receipt already recorded is dropped, and
   * a version older than the stored one changes nothing.
   */
  record(
    person: Person,
    aggregateVersion: number,
    receipt: Receipt
  ): Promise<void>
  find(userId: UserId): Promise<Result<Person, NotFoundError>>
}
