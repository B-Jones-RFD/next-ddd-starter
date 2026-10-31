# Audit

The record of what happened across the app. It only listens to the other contexts and never changes them.

## Language

**Audit log**:
The append-only record of every state change in the domain and every sign-in and sign-out.
_Avoid_: History, event log

**Audit entry**:
One record in the audit log: who did what, to which board, user, or task, and when.
_Avoid_: Event, log line

**Activity**:
The combined, time-ordered view of a task's comments and audit entries.
_Avoid_: Timeline, history, feed
