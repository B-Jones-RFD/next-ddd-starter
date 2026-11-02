import type { Migration } from '@/shared/infrastructure/sqlite/migrate'

// Identity's forward-only migrations (§5). Never edit one that has shipped:
// add a new one, and append it to the list in src/di/migrations.ts.

export const identity001: Migration = {
  context: 'identity',
  name: '001-users-sessions-outbox',
  sql: `
    CREATE TABLE identity_users (
      id TEXT PRIMARY KEY,
      display_name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL,
      version INTEGER NOT NULL
    );

    CREATE TABLE identity_sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL,
      last_seen_at TEXT NOT NULL,
      version INTEGER NOT NULL
    );
    CREATE INDEX identity_sessions_user_id ON identity_sessions (user_id);

    CREATE TABLE identity_outbox (
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
    CREATE INDEX identity_outbox_status ON identity_outbox (status, seq);
  `,
}
