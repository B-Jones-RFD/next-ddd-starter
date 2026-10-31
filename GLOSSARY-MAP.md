# Glossary Map

A multi-user workspace where people organize work as tasks on shared boards.

## Contexts

- [Identity](./src/modules/identity/GLOSSARY.md): users, sign-in, and sign-out
- [Boards](./src/modules/boards/GLOSSARY.md): boards, their members, lists, tasks, tags, and comments
- [Audit](./src/modules/audit/GLOSSARY.md): the audit log and each task's activity

## Relationships

- **Identity → Boards**: A board member is a user, seen from boards. Boards finds users by email by asking identity, and learns display names from identity's `UserRegistered` and `UserRenamed` events.
- **Identity → Audit**: Identity's state changes, sign-ins, and sign-outs become audit entries.
- **Boards → Audit**: Every boards state change becomes an audit entry. Comments are owned by boards and copied into audit only to make up Activity. Audit asks boards for a user's role on a board before showing Activity or a Board log.
- **Shared**: `UserId` is the only domain type all three contexts share.
