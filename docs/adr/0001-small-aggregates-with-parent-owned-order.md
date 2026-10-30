# Small aggregates, with order owned by the parent

The domain has five aggregates: Board (members, roles, tags, and the order of its lists), List (name, archived state, and the ordered ids of its tasks), Task, Comment, and User. They reference each other by id only. A Board decides which lists it has and in what order, and a List decides which tasks it holds and in what order. A Task therefore has no `listId` and no position of its own: the List is the single source of truth for both. Rules that span aggregates, such as archiving a list only when it has no active tasks, assignees being board members, moving a task between lists, and reassigning a departing member's tasks to the Owner, are pure domain services that take the aggregates they need and return the updated ones.

## Considered Options

- **One Board aggregate holding every list and task.** Rejected: every edit would load and lock the whole board.
- **A fractional position key on each List and Task.** Each move would rewrite only one row, but the item would hold an opinion about its own place, which belongs to the parent.
- **Integer positions on each item.** Rejected: a single move renumbers the item's siblings.

## Consequences

- Creating a task writes both the Task and its List. Moving a task between lists writes two Lists. The application layer saves these together.
- Concurrent edits to the same List or Board collide. Every aggregate carries a `version`, and a save with a stale version is rejected.
- Archived lists and tasks keep their place in the parent's order, so restoring one puts it back where it was.
