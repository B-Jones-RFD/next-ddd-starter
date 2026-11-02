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

export const boards002: Migration = {
  context: 'boards',
  name: '002-boards-members',
  sql: `
    CREATE TABLE boards_boards (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      archived INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      version INTEGER NOT NULL
    );

    CREATE TABLE boards_members (
      board_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('owner', 'member')),
      position INTEGER NOT NULL,
      PRIMARY KEY (board_id, user_id)
    );
    CREATE INDEX boards_members_user_id ON boards_members (user_id);
  `,
}

export const boards003: Migration = {
  context: 'boards',
  name: '003-lists',
  sql: `
    CREATE TABLE boards_lists (
      id TEXT PRIMARY KEY,
      board_id TEXT NOT NULL,
      name TEXT NOT NULL,
      position TEXT NOT NULL,
      archived INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      version INTEGER NOT NULL
    );
    -- Lists sort by (position, id), with no unique index on position (§3).
    CREATE INDEX boards_lists_board_order
      ON boards_lists (board_id, position, id);
  `,
}

export const boards004: Migration = {
  context: 'boards',
  name: '004-tasks',
  sql: `
    CREATE TABLE boards_tasks (
      id TEXT PRIMARY KEY,
      board_id TEXT NOT NULL,
      list_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      position TEXT NOT NULL,
      archived INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      version INTEGER NOT NULL
    );
    -- Tasks sort within a list by (position, id), with no unique index on
    -- position (§3). The board index serves the board's read.
    CREATE INDEX boards_tasks_list_order
      ON boards_tasks (list_id, position, id);
    CREATE INDEX boards_tasks_board_id ON boards_tasks (board_id);
  `,
}

export const boards005: Migration = {
  context: 'boards',
  name: '005-comments',
  sql: `
    CREATE TABLE boards_comments (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      board_id TEXT NOT NULL,
      author_id TEXT NOT NULL,
      text TEXT NOT NULL,
      created_at TEXT NOT NULL,
      version INTEGER NOT NULL
    );
    CREATE INDEX boards_comments_task_id ON boards_comments (task_id);
  `,
}
