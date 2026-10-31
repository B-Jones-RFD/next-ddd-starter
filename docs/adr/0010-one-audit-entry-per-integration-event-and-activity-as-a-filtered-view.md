# One audit entry per integration event, and Activity as a filtered view

Audit writes exactly one audit entry for each integration event it receives, and the entry's id is the event's id, so a redelivered event is a no-op. Boards and identity publish fine-grained events named for intent (`boards.TaskRenamed.v1`, not `TaskUpdated`), and every event that changes a value carries `from` and `to`. Audit therefore gets before and after values without keeping a copy of every aggregate. `CommentAdded` becomes an entry too, carrying the comment's text. Activity is then just the entries for one task in time order, read from one table, with no merge of comments and entries. We chose this because it keeps audit a pure consumer of published contracts, and the log stays complete even when boards' internals change.

## Decisions

- **Entry shape**: `{ id, occurredAt, actorId, subject: 'user' | 'board' | 'list' | 'task', subjectId, boardId?, taskId?, action, details, causationId? }`. Audit maps each event contract into its own `AuditEntry` discriminated union, keyed by `action` and written in audit's language, and stores `details` as JSON. A v2 contract changes only that mapper, not stored entries. `domain`-scoped outbox rows never become entries.
- **Consequences**: a change made by a handler, such as passing a removed Board member's assignments to the Owner or stripping a deleted Tag from tasks, is published as an ordinary event (`TaskAssigned`, `TaskUntagged`). Its `actorId` is the user who started the chain, and its `causationId` points at the triggering event ([ADR 0007](./0007-one-aggregate-per-transaction-with-a-transactional-outbox.md)'s envelope). There is no `system` user.
- **Names**: entries store ids. Audit builds its own name projections (people, boards, lists, tasks, tags) from the events it already receives and shows *current* names. Historic values that matter, such as a rename, are in `from` and `to`.
- **Reads**: every view is newest first, with keyset pagination on the entry id (UUID v7), 50 per page. **Activity** is readable by any Board member, the **Board log** only by the board's Owner, and the **User log** only by that user. There is no app-wide view. Access is checked at read time through audit's `IBoardAccess.roleOf(boardId, userId): Promise<'owner' | 'member' | null>`, so a removed member or a former Owner loses access at once. Their own past actions stay in the log.
- **Reorders** (`ListReordered`, `TaskReordered`) are recorded, because every state change is audited, but hidden by default behind a "show reorders" toggle. Positions are opaque keys, so these entries carry no `from` or `to`.
- **Nothing is pruned.** Entries about archived boards, lists and tasks stay readable.
- **Lag is expected.** Activity trails the command by one relay drain. `app/` shows a just-posted comment with `useOptimistic` until a refresh picks it up. It never awaits the relay.

## Boards v1 integration events

Every event is `boards.<Name>.v1` and carries `boardId`. Changes to a value carry `from` and `to`.

- **Board**: `BoardCreated { name }`, `BoardRenamed`, `BoardArchived`, `BoardRestored`, `MemberAdded { userId }`, `MemberRemoved { userId }`, `MemberLeft { userId }`, `OwnershipTransferred { fromUserId, toUserId }`, `TagCreated { tagId, name, color }`, `TagRenamed`, `TagRecolored`, `TagDeleted { tagId, name }`
- **List**: `ListCreated { listId, name }`, `ListRenamed`, `ListReordered`, `ListArchived`, `ListRestored`
- **Task**: `TaskCreated { taskId, listId, title }`, `TaskRenamed`, `TaskDescriptionChanged`, `TaskMoved { fromListId, toListId }`, `TaskReordered`, `TaskArchived`, `TaskRestored`, `TaskAssigned { userId }`, `TaskUnassigned { userId }`, `TaskTagged { tagId }`, `TaskUntagged { tagId }`
- **Comment**: `CommentAdded { commentId, taskId, text }`

Identity's v1 events (`UserRegistered`, `UserRenamed`, `UserPasswordChanged`, `UserSignedIn`, `UserSignedOut`) become User log entries.

## Considered Options

- **Coarse events with a field diff** (`TaskUpdated { changes }`). Fewer contracts, but audit would have to interpret diffs, and the event names would say nothing.
- **Audit keeps a copy of each aggregate to compute before and after.** It keeps events small, but it duplicates boards' model inside audit.
- **Activity merges a separate comments projection with entries.** It's closer to the glossary's old wording, but a merge across two tables adds nothing the single filter doesn't already give.
- **Names copied into every event payload.** Entries would render with no projections, but presentation needs would leak into boards' contracts.
- **A reserved `system` actor for Consequences.** No envelope change, but `actorId` would stop being a `UserId`, and the entry would lose who started the chain.
- **Awaiting the relay before refreshing.** Activity would never lag, but this stops working once audit runs in its own process.
