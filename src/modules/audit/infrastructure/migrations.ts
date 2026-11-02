import type { Migration } from '@/shared/infrastructure/sqlite/migrate'

// Audit's forward-only migrations (§5). Never edit one that has shipped: add
// a new one, and append it to the list in src/di/migrations.ts.

export const audit001: Migration = {
  context: 'audit',
  name: '001-entries-names-inbox-outbox',
  sql: `
    CREATE TABLE audit_entries (
      id TEXT PRIMARY KEY,
      occurred_at TEXT NOT NULL,
      actor_id TEXT NOT NULL,
      subject TEXT NOT NULL
        CHECK (subject IN ('user', 'board', 'list', 'task')),
      subject_id TEXT NOT NULL,
      board_id TEXT,
      task_id TEXT,
      action TEXT NOT NULL,
      details TEXT NOT NULL,
      causation_id TEXT
    );
    -- Views read newest first by id (UUID v7), keyset-paginated.
    CREATE INDEX audit_entries_task ON audit_entries (task_id, id);
    CREATE INDEX audit_entries_board ON audit_entries (board_id, id);
    CREATE INDEX audit_entries_subject
      ON audit_entries (subject, subject_id, id);

    CREATE TABLE audit_names (
      kind TEXT NOT NULL
        CHECK (kind IN ('person', 'board', 'list', 'task', 'tag')),
      id TEXT NOT NULL,
      name TEXT NOT NULL,
      aggregate_version INTEGER NOT NULL,
      PRIMARY KEY (kind, id)
    );
    CREATE INDEX audit_names_id ON audit_names (id);

    CREATE TABLE audit_inbox (
      event_id TEXT NOT NULL,
      handler TEXT NOT NULL,
      handled_at TEXT NOT NULL,
      PRIMARY KEY (event_id, handler)
    );

    -- Audit publishes nothing yet, but every context has one outbox (§6).
    CREATE TABLE audit_outbox (
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
    CREATE INDEX audit_outbox_status ON audit_outbox (status, seq);
  `,
}
