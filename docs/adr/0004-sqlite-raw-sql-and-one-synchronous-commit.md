# SQLite through `node:sqlite`, raw SQL, and every write as one synchronous unit-of-work commit

The app stores its data in one SQLite file, reached through Node's built-in `node:sqlite` (`Database`, so Node `>=26`) with hand-written SQL and prepared statements: no driver package, query builder or ORM. Repositories only load aggregates. Writes go through `IUnitOfWork.commit(changes)`. `changes` is one plain object of named arrays (`{ boards, lists, tasks, comments, users }`). `commit` runs `BEGIN IMMEDIATE`, every write with its version check, and `COMMIT` synchronously, with no `await` between them, so there is no `repo.save()` and no transaction stays open across an `await`. We chose this because `node:sqlite` is synchronous and uses one shared connection: any `await` inside an open transaction would let another request's statements run inside it. The domain already returns `{ state, events }`, so a use case has every changed aggregate in hand at the end anyway.

## Considered Options

- **A transaction callback (`uow.run(async repos => …)`).** This is the familiar shape, but `await`s inside the callback interleave other requests on the shared connection. Making it safe needs either a global lock, which makes every request wait on the slowest transaction, or a connection per transaction. A connection per transaction holds SQLite's single write lock across every `await` and makes repositories per-transaction objects.
- **Synchronous ports.** These would make a plain `BEGIN … COMMIT` safe, but they let SQLite's API shape the application layer, and moving to any networked database would mean rewriting every port.
- **A `save()` per aggregate with no shared transaction.** Creating a task (Task + List) could then half-succeed, which would need compensation logic.
- **A JSON array of task ids on `lists`.** This would mirror the aggregate exactly, but it loses foreign keys and the database's guarantee that a task sits in exactly one list.
- **`DatabaseSync` on Node `>=24.15`.** This was rejected because Node 26 deprecates that name (DEP0210), and a reference app should show the current API.

## Consequences

- Persistence owns `version`. A new aggregate carries `version: 0` and becomes an `INSERT` at version 1. An update runs `… WHERE id = ? AND version = ?`, and 0 changed rows means a stale write, which rolls back the whole commit.
- Reads happen outside the transaction. The version check catches anyone who changed an aggregate between load and commit, so they get a clean conflict instead of a lost update.
- A parent's order lives in join tables, `board_lists(board_id, list_id UNIQUE, position)` and `list_tasks(list_id, task_id UNIQUE, position)`, which only the parent's save rewrites. `tasks` has no `list_id`. These integer positions belong to the parent's rows, not the items, so they don't break ADR 0001.
- Later writes that must commit with a change, such as audit entries, join `changes` as new named arrays rather than reshaping the port.
