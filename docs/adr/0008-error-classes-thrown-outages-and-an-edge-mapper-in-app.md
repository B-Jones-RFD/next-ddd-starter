# Error classes, returned expectations, thrown outages, and one edge mapper in `app/`

Errors are classes that extend `AppError` (abstract, with a literal `code`) in `src/shared/kernel/errors/`. Expected outcomes, which a caller can act on, are **returned** in a `Result` and declared in the signature. Outages are **thrown** as a translated `InfrastructureError`. Error classes cross module boundaries, because each module's `api.ts` re-exports them. Only `app/` turns them into plain, serializable objects, through one mapper that also holds every piece of user-facing wording. We chose classes for `instanceof`, `cause` chaining and stack traces. Throwing outages means use cases don't need an early return for failures they can't act on (the guide's "catch only when you can act"). Keeping the conversion in `app/` puts all user-facing text in one layer. Apps built from this template will add external services, so the hierarchy separates persistence failures from external-service failures now.

## The catalog

```
AppError (abstract, readonly code)          src/shared/kernel/errors/
├─ DomainError (abstract)
│   ├─ ValidationError  { fields }          domain parsers and Zod input schemas
│   ├─ ForbiddenError                       the domain checking the actor
│   └─ <rule errors>                        domain/<agg>/<agg>.errors.ts, e.g. ListArchivedError
├─ NotFoundError { entity, id }             returned by ports
├─ ConflictError { entity, id }             returned by save() on a stale version
├─ UnauthenticatedError
└─ InfrastructureError (abstract) { port, retryable }   thrown, never returned
    ├─ PersistenceError
    └─ ExternalServiceError                 none in this app; the pattern for apps built from it
```

Rule errors are coded `<context>.<aggregate>.<rule>` (`boards.list.archived`), and the shared errors use bare codes (`validation`, `forbidden`, `not-found`, `conflict`, `unauthenticated`). There is no `UnexpectedError` class: `unexpected` exists only in `app/`'s plain `ActionError`.

## Considered Options

- **Plain unions keyed by `kind`** ([ADR 0005](./0005-ports-declare-their-errors-and-composition-catches-the-rest.md)). Always serializable, but they have no `instanceof`, no stack and no `cause`, and every port has to return every infrastructure failure.
- **Convert to a plain `PublicError` at each module's `api.ts`.** This fits the type-only `contracts.ts`, but it moves the error translation, and with it the closeness to the user-facing wording, out of `app/`. It was rejected in favour of callers handling the real classes.
- **One `InfrastructureError` with a `port` field.** Enough for an app with only SQLite, but templates need the persistence/external-service split.
- **A `traced` in the shared kernel with no OTel import**, with a tracer registered globally at runtime. Rejected: if `register()` hadn't run, spans would be dropped silently.
- **Each use case traces itself through a tracer port.** Rejected: it adds code to every feature.
- **A runtime test that calls every `api.ts` export and counts ended spans.** Rejected, because lint already enforces the wrapping statically.

## Consequences

- **This supersedes [ADR 0005](./0005-ports-declare-their-errors-and-composition-catches-the-rest.md).** Kept from it: Zod checks shape and the domain parsers own the rules, ports declare their expected errors, error data is limited to codes, ids and field names (never user input), expected errors are span attributes with the status left unset, and the application and domain layers never import OpenTelemetry.
- **Adapters** never let a raw `node:sqlite` or SDK error escape. They throw a `PersistenceError` or `ExternalServiceError`, keep the original as `cause`, and set `retryable` (`SQLITE_BUSY` is retryable). Mock adapters throw the same classes.
- **Use cases** catch an `InfrastructureError` only when they can retry, compensate or fall back. Otherwise it propagates.
- **`message`** is required by `Error` but is for developers only. It is never shown to users.
- **Error classes cross boundaries at runtime**: `api.ts` re-exports them, and `contracts.ts` stays type-only. When another context calls in, its ACL adapter catches the upstream context's errors, thrown ones included, and translates them into its own port's errors, so one context's error classes never reach another's domain.
- **`traced(name, fn)`** in `src/shared/infrastructure/tracing/` wraps every command and query that `api.ts` exports. It records each expected error's `code`, records a thrown error with its `cause`, sets the span status to `ERROR`, and rethrows unchanged. It never converts errors. Error classes and types are re-exported from `api.ts` as they are.
- **The wrapping is written in `api.ts`**, one line per use case: `export const createBoard = traced('<span name>', createBoardCommand)`. The span name is passed explicitly as `<module>.<exportName>` (`boards.moveTask`), and lint checks its format ([ADR 0016](./0016-span-names-and-app-attributes-are-a-contract.md)). _(Amended by the span naming decision.)_ An ACL adapter that calls another context's `api.ts` therefore gets a nested span with no extra code.
- **Use cases live only in `application/commands/` and `application/queries/`.** The lint rule below relies on this, so no other folder holds one.
- **Lint enforces the wrapping statically.** `api.ts` gets its own `no-restricted-imports` block, separate from `contracts.ts`: the same allowlist plus exactly `@/shared/infrastructure/tracing`. `contracts.ts` keeps the old allowlist and stays type-only. `api.ts` also gets these `no-restricted-syntax` selectors (`UC` is the regex `/\/application\/(commands|queries)\//`):

  | Selector                                                                                                                         | Bans                                                                                        |
  | -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
  | `ExportNamedDeclaration > VariableDeclaration > VariableDeclarator:not([init.type='CallExpression'][init.callee.name='traced'])` | an exported `const` that isn't a `traced(...)` call                                         |
  | `ExportNamedDeclaration[exportKind='value'][source.value=UC] > ExportSpecifier[exportKind='value']`                              | re-exporting a command or query unwrapped (`export type` and inline `type` specifiers pass) |
  | `ExportAllDeclaration[exportKind='value']`                                                                                       | `export *` (`export type *` passes)                                                         |
  | `ExportNamedDeclaration[source=null] > ExportSpecifier[exportKind='value']`                                                      | a local `export { x }`                                                                      |
  | `ExportNamedDeclaration > :matches(FunctionDeclaration, ClassDeclaration)`                                                       | an exported function or class                                                               |
  | `ExportDefaultDeclaration`                                                                                                       | a default export                                                                            |

  Because the rule is static, there is no runtime test that calls every export and counts spans.

- **`src/app/_lib/errors/to-action-error.ts`** is the only error conversion. It turns any error into a plain `ActionError`, maps each `code` to wording, and makes anything thrown into `unexpected` with the trace id as its `reference`. Nothing in `app/` returns an error, passes one to a Client Component or caches one in `'use cache'` without going through it.
- **Server Actions** wrap the call in `try/catch` and always return `{ ok: false, error: ActionError }`, outages and bugs included, so a failed save shows a message in its form. **Pages and layouts** call `notFound()` for a `NotFoundError`, call `notFound()` or `redirect()` for `ForbiddenError` and `UnauthenticatedError`, and let anything thrown reach `error.tsx` and `onRequestError`.
- **`retryable`** is set by the adapter. Whether and how the outbox relay acts on it is left to the audit mechanism.
