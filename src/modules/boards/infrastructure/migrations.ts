import type { Migration } from '@/shared/infrastructure/sqlite/migrate'

// Boards' forward-only migrations (§5). Never edit one that has shipped: add
// a new one, and append it to the list in src/di/migrations.ts.

export const boards001: Migration = {
  context: 'boards',
  name: '001-people-inbox-outbox',
  sql: `
    CREATE TABLE boards_people (
      user_id TEXT PRIMARY KEY,
      display_name TEXT NOT NULL,
      aggregate_version INTEGER NOT NULL
    );

    CREATE TABLE boards_inbox (
      event_id TEXT NOT NULL,
      handler TEXT NOT NULL,
      handled_at TEXT NOT NULL,
      PRIMARY KEY (event_id, handler)
    );

    CREATE TABLE boards_outbox (
      seq INTEGER PRIMARY KEY AUTOINCREMENT,
      id TEXT NOT NULL UNIQUE,
      scope TEXT NOT NULL CHECK (scope IN ('domain', 'integration')),
      type TEXT NOT NULL,
      version INTEGER NOT NULL,
      occurred_at TEXT NOT NULL,
      aggregate_id TEXT NOT NULL,
      aggregate_version INTEGER NOT NULL,
      actor_id TEXT NOT NULL,
      causation_id TEXT,
      payload TEXT NOT NULL,
      trace_context TEXT,
      status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'delivered', 'failed')),
      attempts INTEGER NOT NULL DEFAULT 0,
      last_error TEXT,
      next_attempt_at TEXT,
      first_failed_at TEXT,
      delivered_at TEXT
    );
    CREATE INDEX boards_outbox_status ON boards_outbox (status, seq);
  `,
}
