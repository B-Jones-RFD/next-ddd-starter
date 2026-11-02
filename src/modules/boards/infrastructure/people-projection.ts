import type { DatabaseSync } from 'node:sqlite'

import type {
  IPeopleProjection,
  Person,
  Receipt,
} from '@/modules/boards/application/ports/people-projection.port'
import {
  ROLLBACK,
  transaction,
} from '@/shared/infrastructure/sqlite/transaction'
import { query } from '@/shared/infrastructure/sqlite/translate-error'
import { NotFoundError } from '@/shared/kernel/errors/app-error'
import { err, ok, type Result } from '@/shared/kernel/result'
import { toUserId, type UserId } from '@/shared/kernel/user-id'

const PORT = 'IPeopleProjection'

/** `boards_people`, with its inbox rows in `boards_inbox`. */
export class PeopleProjection implements IPeopleProjection {
  constructor(private readonly db: DatabaseSync) {}

  async record(
    person: Person,
    aggregateVersion: number,
    receipt: Receipt
  ): Promise<void> {
    transaction(this.db, PORT, () => {
      const { changes } = this.db
        .prepare(
          `INSERT INTO boards_inbox (event_id, handler, handled_at)
           VALUES (?, ?, ?) ON CONFLICT DO NOTHING`
        )
        .run(receipt.eventId, receipt.handler, new Date().toISOString())
      // Already applied: a redelivery.
      if (changes === 0) return ROLLBACK
      this.db
        .prepare(
          `INSERT INTO boards_people (user_id, display_name, aggregate_version)
           VALUES (?, ?, ?)
           ON CONFLICT (user_id) DO UPDATE
           SET display_name = excluded.display_name,
               aggregate_version = excluded.aggregate_version
           WHERE excluded.aggregate_version > boards_people.aggregate_version`
        )
        .run(person.userId, person.displayName, aggregateVersion)
      return true
    })
  }

  async find(userId: UserId): Promise<Result<Person, NotFoundError>> {
    const row = query(
      PORT,
      () =>
        this.db
          .prepare(
            'SELECT user_id, display_name FROM boards_people WHERE user_id = ?'
          )
          .get(userId) as { user_id: string; display_name: string } | undefined
    )
    return row
      ? ok({ userId: toUserId(row.user_id), displayName: row.display_name })
      : err(new NotFoundError('Person', userId))
  }
}
