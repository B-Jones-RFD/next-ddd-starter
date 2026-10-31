# Audit

The record of what happened across the app. It only listens to the other contexts and never changes them.

## Language

**Audit log**:
The append-only record of every state change in the domain and every sign-in and sign-out. Nothing is ever removed from it.
_Avoid_: History, event log

**Audit entry**:
One record in the audit log: who did what, to which user, board, list, or task, and when.
_Avoid_: Event, log line

**Consequence**:
An audit entry for a change the app made on its own because of another change, such as a removed board member's assignments passing to the Owner. It names the change that caused it and carries that change's actor.
_Avoid_: System action, side effect, cascade

**Activity**:
The time-ordered audit entries for one task, its comments included, readable by its board's members.
_Avoid_: Timeline, history, feed

**Board log**:
The audit entries for one board, readable only by its Owner.
_Avoid_: Board history, board activity

**User log**:
A user's own sign-ins, sign-outs, and account changes, readable only by that user.
_Avoid_: Account history, login history
