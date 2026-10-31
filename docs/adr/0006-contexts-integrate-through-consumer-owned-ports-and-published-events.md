# Contexts integrate through consumer-owned ports and published events

A context that needs an answer from another context right now **asks**: it defines a port in its own language (boards' `IUserDirectory.findByEmail`, audit's `IBoardAccess.isMember`), and an adapter in its `infrastructure/` calls the other context's public API, acting as an anti-corruption layer. A context that changes state **tells**: it translates its internal domain events into versioned integration events (`boards.TaskMoved.v1`), which are a published contract of plain, serializable fields. Consumers subscribe to those contracts and never call back. No context calls another context's commands to cause a side effect. Integration events are delivered at least once and written atomically with the state change that raised them. Consumers deduplicate by event id. Each context owns its tables, so there are no cross-context joins or foreign keys. We chose this so each context's model can change without breaking the others, and so the Audit log cannot miss a state change.

## Considered Options

- **Direct synchronous calls to the other context's public API, with no port.** Less code, but the consumer is coupled to the supplier's model.
- **Publishing domain events directly.** Less code, but every refactor of a context's internals breaks its consumers.
- **In-process dispatch after commit.** No outbox, but if the process dies between commit and dispatch, the Audit entry is lost for good.
- **Shared tables with cross-context joins.** Simpler reads, but the contexts are bounded only in name, and splitting one out later means untangling the SQL.

## Consequences

- Every boards and identity state change is published as an integration event, because audit records all of them. Sign-ins and sign-outs are published by identity.
- Event handlers live in the consumer's `application/` and import the supplier's published contracts directly. Ports used for asking are implemented only in `infrastructure/` ([ADR 0002](./0002-modules-around-a-pure-domain-with-next-confined-to-app.md) lists the import rules).
- Tables are prefixed by their owning context (`identity_users`, `boards_tasks`, `audit_entries`). They still share one SQLite file and one connection, and that is an accepted compromise.
- Boards shows Users' display names from its own `boards_people` projection, fed by identity's `UserRegistered` and `UserRenamed` events, so names can lag briefly.
- Audit owns Activity. It builds Activity from the events it receives, so `CommentAdded` carries the comment text. Comments themselves still belong to boards. Audit checks board membership through `IBoardAccess` at read time instead of keeping a membership projection, so a removed Board member loses access to Activity immediately.
- The outbox mechanics (table, dispatch timing, how they fit the synchronous commit) are decided in [ADR 0007](./0007-one-aggregate-per-transaction-with-a-transactional-outbox.md). Where contracts and public APIs live in each module is decided with the module public API.
