# Task Boards

A multi-user workspace where people organize work as tasks on shared boards.

## Language

### People and access

**User**:
A person with an account who can sign in.
_Avoid_: Account, profile

**Board member**:
A user whom an Owner has added to a board. Every board member has exactly one role on that board.
_Avoid_: Collaborator, participant, share

**Owner**:
The board-member role that can rename or archive the board and manage its members. A board has exactly one Owner at all times: the user who created it, until they transfer ownership to another board member, who becomes the Owner while they become a Member. The Owner cannot leave the board without first transferring ownership.
_Avoid_: Admin

**Member**:
The board-member role that can work with the board's lists and tasks but not manage the board itself.
_Avoid_: Editor, contributor

### Work

**Board**:
A shared space, visible only to its board members, that holds lists of tasks.
_Avoid_: Project, workspace

**List**:
A named, ordered column on a board that holds tasks. The list a task sits in is that task's status.
_Avoid_: Column, lane, stage, status

**Task**:
A single unit of work on a board, sitting in exactly one list.
_Avoid_: Card, todo, item, ticket

**Assignee**:
A board member responsible for a task. A task can have any number of assignees, all board members of its board.
_Avoid_: Owner (of a task), responsible, assigned user

**Tag**:
A label defined on one board that its board members can attach to that board's tasks.
_Avoid_: Label, category

**Archived**:
The state of a board, list, or task that is hidden by default and read-only, but can be restored. Boards, lists, and tasks are never deleted, only archived. A list can be archived only when none of its tasks are active.
_Avoid_: Hidden, soft-deleted, closed

**Active**:
The state of a board, list, or task that is not archived.
_Avoid_: Open, live

**Comment**:
Free text a board member writes on a task, recorded with its author and time.
_Avoid_: Note, message

### Audit

**Audit log**:
The append-only record of every state change in the domain and every sign-in and sign-out.
_Avoid_: History, event log

**Audit entry**:
One record in the audit log: who did what, to which board, user, or task, and when.
_Avoid_: Event, log line

**Activity**:
The combined, time-ordered view of a task's comments and audit entries.
_Avoid_: Timeline, history, feed
