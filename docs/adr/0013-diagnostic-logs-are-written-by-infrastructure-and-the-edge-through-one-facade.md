# Diagnostic logs are written only by infrastructure and the edge, through one facade

A **diagnostic log** (technical and operational, never the Audit log) is written through one facade in `src/shared/infrastructure/logging/`, a module-level pino logger that the code imports directly. It is not a port in `shared/kernel/ports`, it has no container binding, and it has no mock twin. Domain and application never log. Infrastructure, `src/di/`, the root instrumentation shims and the `app/` edge may. A thrown error is logged exactly once, where it leaves the server: `onRequestError` logs throws from pages, layouts and Route Handlers, and `to-action-error` logs whatever it turns into `unexpected`, under the same trace id it returns as the `reference`. `traced` only records errors on the span. We chose this because nothing behind a port needs to log, the code that does log (`traced`, the relay, `instrumentation.ts`) runs outside the container or before it exists, and logging at the edge gives each failure one line that a user's reference can find.

## Decisions

- **Interface**: our own narrow surface, not pino's `Logger` type: `logger.debug|info|warn|error(event, fields?)` and `logger.child(bindings)`. `event` is a stable dotted name (`outbox.row.failed`), not prose. `fields` is a typed `LogFields` bag of codes, ids, field names and an `err` slot, never user input ([ADR 0008](./0008-error-classes-thrown-outages-and-an-edge-mapper-in-app.md)). The facade starts with `import 'server-only'`.
- **Who may import it**: `src/shared/infrastructure/**`, each module's `infrastructure/` (adapters, the outbox relay and event handlers, which is where [ADR 0007](./0007-one-aggregate-per-transaction-with-a-transactional-outbox.md)'s "logged and skipped" happens), `src/di/**`, `src/instrumentation.ts` / `src/instrumentation.node.ts`, and in `src/app/` exactly `@/shared/infrastructure/logging`.
- **Enforcement**: `no-restricted-imports` bans `pino` and `pino/*` everywhere except the facade, so the trace-id mixin and `redact` can't be bypassed. `no-console` is an error across `src/`. The existing allowlists already keep domain/ and application/ from reaching the logger.

## Considered Options

- **An `ILogger` port injected through the container.** Rejected. Only infrastructure and the edge log, and they import infrastructure anyway. Tests don't assert on logs ([ADR 0012](./0012-tests-go-through-api-on-mock-adapters-kept-honest-by-contract-suites.md)), and mock and test output is a configuration concern.
- **`traced` logs thrown errors.** Rejected. Nested `traced` spans would log the same error once per level, and an RSC throw would be logged again by `onRequestError`.
- **Letting application log a swallowed outage.** Rejected. A use case that hides an outage behind a fallback is the thing to fix. If a fallback must be visible, the adapter that threw logs it.

## Consequences

- `src/app/`'s import rule becomes "only `@/modules/*/api`, `@/app/**` and `@/shared/infrastructure/logging`".
- `docs/DDD-ARCHITECTURE.md`'s `shared/lib/logger.ts` and the `logger.error(e)` in its `toActionError` example are superseded. The guide is revised in the observability consolidation.
- `di/container.ts`'s `console.warn` for falling back to mock adapters becomes a logger call.
