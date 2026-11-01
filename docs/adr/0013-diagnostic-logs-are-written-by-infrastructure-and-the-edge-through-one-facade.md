# Diagnostic logs are written only by infrastructure and the edge, through one facade

A **diagnostic log** (technical and operational, never the Audit log) is written through one facade in `src/shared/infrastructure/logging/`, a module-level pino logger that the code imports directly. It is not a port in `shared/kernel/ports`, it has no container binding, and it has no mock twin. Domain and application never log. Infrastructure, `src/di/`, the root instrumentation shims and the `app/` edge may. A thrown error is logged exactly once, where it leaves the server: `onRequestError` logs throws from pages, layouts and Route Handlers, and `to-action-error` logs whatever it turns into `unexpected`, under the same trace id it returns as the `reference`. `traced` only records errors on the span. We chose this because nothing behind a port needs to log, the code that does log (`traced`, the relay, `instrumentation.ts`) runs outside the container or before it exists, and logging at the edge gives each failure one line that a user's reference can find.

## Decisions

- **Interface**: our own narrow surface, not pino's `Logger` type: `logger.debug|info|warn|error(event, fields?)` and `logger.child(bindings)`. `event` is a stable dotted name (`outbox.row.failed`), not prose. `fields` is typed per event (`LogEventFields[event]`): codes, ids, field names and an `err` slot, never user input ([ADR 0008](./0008-error-classes-thrown-outages-and-an-edge-mapper-in-app.md), [ADR 0017](./0017-telemetry-keeps-user-input-out-by-construction-except-error-messages.md)). _(Amended by the no-user-input enforcement decision.)_ The facade starts with `import 'server-only'`.
- **Who may import it**: `src/shared/infrastructure/**`, each module's `infrastructure/` (adapters, the outbox relay and event handlers, which is where [ADR 0007](./0007-one-aggregate-per-transaction-with-a-transactional-outbox.md)'s "logged and skipped" happens), `src/di/**`, `src/instrumentation.ts` / `src/instrumentation.node.ts`, and in `src/app/` exactly `@/shared/infrastructure/logging`.
- **Enforcement**: `no-restricted-imports` bans `pino` and `pino/*` everywhere except the facade, so the trace-id mixin and the `err` serializer can't be bypassed. There is no `redact` ([ADR 0017](./0017-telemetry-keeps-user-input-out-by-construction-except-error-messages.md)). _(Amended by the no-user-input enforcement decision.)_ `no-console` is an error across `src/`. The existing allowlists already keep domain/ and application/ from reaching the logger.

## What gets logged, and at what level

_(Amended by the "What gets logged" decision.)_

- **Levels** each mean one thing. `error`: a person needs to look. `warn`: degraded but self-healing, or an unusual setup. `info`: rare lifecycle events. `debug`: high-volume detail for development. The default is `info` in production and `debug` in dev, and `LOG_LEVEL` overrides it. Its accepted values and validation are in [ADR 0015](./0015-observability-is-configured-by-standard-otel-env-with-safe-defaults.md). There is no `fatal`: a fatal condition is a throw.
- **Events** are a closed `LogEvent` union in the facade, so a new one is added on purpose:

  | Event                    | Level | Written by                                                                                                                             |
  | ------------------------ | ----- | -------------------------------------------------------------------------------------------------------------------------------------- |
  | `action.unexpected`      | error | `to-action-error`, for anything it maps to `unexpected`, whatever `retryable` says, so a user's `reference` always finds an error line |
  | `request.failed`         | error | `onRequestError`                                                                                                                       |
  | `outbox.row.retrying`    | warn  | the relay, on every retryable failure, with `attempts` and `nextDelayMs`                                                               |
  | `outbox.row.stuck`       | error | the relay, once, when a row has been retrying for 5 minutes                                                                            |
  | `outbox.row.recovered`   | info  | the relay, when a row delivers after at least one failure, with total attempts and duration                                            |
  | `outbox.row.failed`      | error | the relay, when a row is marked `failed`                                                                                               |
  | `outbox.row.delivered`   | debug | the relay, on a normal delivery                                                                                                        |
  | `app.started`            | info  | `register()`: adapter mode, span processor, whether logs export, the level. The relay start is part of this. `warn` in production when traces are `none` ([ADR 0015](./0015-observability-is-configured-by-standard-otel-env-with-safe-defaults.md)) |
  | `adapters.mock_fallback` | warn  | `di/`, with the names (never values) of the missing env vars                                                                           |
  | `outbox.replay.reset`    | info  | `npm run outbox:replay`, with the outbox and row count                                                                                 |

- **Not logged**: expected errors (span attributes only, per [ADR 0008](./0008-error-classes-thrown-outages-and-an-edge-mapper-in-app.md)), drain cycles, and startup config errors that throw (the throw is the record). There is **no per-request access log**: Next's root span records every request, and `logging.incomingRequests` only affects dev.
- **Fields on every line**: `time`, `level`, `event`, `service` (from `OTEL_SERVICE_NAME`), `trace_id` / `span_id` / `trace_flags` whenever a span is active, and `module` bound by child loggers in a module's `infrastructure/`. pino's `pid` and `hostname` are dropped (the OTel resource carries them), and there is no `useCase` field (that is the `traced` span name).
- **Logs point at traces, they don't copy them.** A line carries the event, error `code`, the ids needed to act and, on `error`, the `err` slot. It never carries span timings, attributes or request shape. An `error` line must stand on its own, because with the `none` span processor nothing else is exported. `err` serializes exactly `type`, `message`, `stack`, `code`, `retryable` and `AppError`'s declared data properties along the full `cause` chain, through a custom serializer, never pino's `stdSerializers.err` ([ADR 0017](./0017-telemetry-keeps-user-input-out-by-construction-except-error-messages.md)).
- **`onRequestError`** logs `routePath`, `routeType`, `renderSource` and `method`, never `path`, which holds ids and can hold user input in its query.
- **CLIs** such as `outbox:replay` run with `--conditions=react-server`, so the facade keeps its `server-only` guard. Without that condition, `server-only` resolves to a module that throws.

## Considered Options

- **An `ILogger` port injected through the container.** Rejected. Only infrastructure and the edge log, and they import infrastructure anyway. Tests don't assert on logs ([ADR 0012](./0012-tests-go-through-api-on-mock-adapters-kept-honest-by-contract-suites.md)), and mock and test output is a configuration concern.
- **`traced` logs thrown errors.** Rejected. Nested `traced` spans would log the same error once per level, and an RSC throw would be logged again by `onRequestError`.
- **A per-request access log.** Rejected. Traces already record every request, and a Route Handler wrapper would miss pages and Server Actions.
- **`warn` forever for a retrying row.** Rejected. A long outage would never page anyone, so the row escalates once to `error` after 5 minutes.
- **Letting application log a swallowed outage.** Rejected. A use case that hides an outage behind a fallback is the thing to fix. If a fallback must be visible, the adapter that threw logs it.

## Consequences

- `src/app/`'s import rule becomes "only `@/modules/*/api`, `@/app/**` and `@/shared/infrastructure/logging`".
- `docs/DDD-ARCHITECTURE.md`'s `shared/lib/logger.ts` and the `logger.error(e)` in its `toActionError` example are superseded. `standards.md` §8 Observability states the rules; the guide carries the superseded banner.
- `di/container.ts`'s `console.warn` for falling back to mock adapters becomes a logger call.
- A per-request access log, if an app needs one, is built per app.
- Every CLI script in `package.json` passes `--conditions=react-server`.
