# Span names and `app.*` attributes are a contract

The template's own spans follow one naming scheme and carry a small, fixed set of `app.*` attributes. A request span is named after the `api.ts` export it wraps (`boards.moveTask`). Relay spans have fixed names (`outbox.drain`, `outbox.deliver`, `outbox.handle`). Dashboards, alerts and saved queries in a backend depend on these names and keys the way they depend on [ADR 0014](./0014-outbox-backlog-gauges-are-the-only-metrics-the-template-ships.md)'s instruments, so the attribute keys and relay span names are a contract. Spans carry codes, ids and names that infrastructure already holds, never anything read from a use case's input, and never who the user is. We chose this because it gives every span a module and a meaning without any per-feature code, and it keeps personal data out of a vendor backend, where it is hard to purge.

## Decisions

- **Request span names are `<module>.<exportName>`**, for example `boards.moveTask`. `<exportName>` is exactly the camelCase name exported from that module's `api.ts`. This matches the `boards.TaskMoved` prefix of integration events ([ADR 0007](./0007-one-aggregate-per-transaction-with-a-transactional-outbox.md)). The command/query folder is not part of the name.
- **Lint checks the format, and review checks the match.** The ESLint config generates one block per module, so `src/modules/boards/api.ts` gets a `no-restricted-syntax` selector that bans any `traced(...)` call whose first argument is not a string literal matching `^boards\.[a-z][A-Za-z0-9]*$`. A selector can't compare the literal with the exported identifier, so review checks that the two are equal. The template adds no custom ESLint rule.
- **`traced` sets `app.module`** by taking the span name up to its first `.`. It matches the `module` field on diagnostic log lines ([ADR 0013](./0013-diagnostic-logs-are-written-by-infrastructure-and-the-edge-through-one-facade.md)). There is no `app.use_case` attribute, because the span name already names the use case.
- **`traced` records nothing from its input.** Request spans carry no aggregate ids or arguments. Doing so would need code in every feature or reflection over the input. Their attributes are `app.module` and, on failure, `app.error.kind` / `app.error.code` ([ADR 0008](./0008-error-classes-thrown-outages-and-an-edge-mapper-in-app.md)).
- **No actor on any span or metric.** Neither `actorId` nor the semconv `user.id` is recorded. It is a pseudonymous identifier, which is still personal data, and the trace id `reference` a user is shown already finds their failing request. An app that needs it adds it deliberately.
- **Relay spans**:

  | Span                               | Kind       | When                                    | Attributes                                                                                                                                                                  |
  | ---------------------------------- | ---------- | --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
  | `outbox.drain`                     | `INTERNAL` | a cycle that claims at least one row    | `app.outbox.rows` (rows claimed across every outbox)                                                                                                                        |
  | `outbox.deliver <type>`            | `CONSUMER` | each row, linked to its `trace_context` | `app.outbox.name`, `app.outbox.scope` (`domain`\|`integration`), `app.outbox.attempt`, `app.event.id`, `app.event.type`, `app.event.causation_id`, `app.event.aggregate_id` |
  | `outbox.handle <module>.<handler>` | `INTERNAL` | each handler, a child of the delivery   | `app.module` (the module that owns the handler)                                                                                                                             |
  - An idle poll claims no rows and starts no span, so polling never fills the backend with empty traces.
  - `<type>` is the envelope's `type` as stored: `boards.TaskMoved` for an integration row, `TaskMoved` for a domain row.
  - `app.outbox.name` takes the same values as on the backlog gauges ([ADR 0014](./0014-outbox-backlog-gauges-are-the-only-metrics-the-template-ships.md)): the module that owns the outbox. On a handler span, `app.module` is the consuming module, so the two differ for a cross-context handler.
  - Handlers register with a name of the form `<module>.<camelCaseName>` (for example `audit.recordTaskMoved`). The relay asserts the format when a handler is registered, since handlers are not `api.ts` exports and lint can't see them.
  - A handler that throws sets `ERROR` on its span, as `traced` does.

- **Replay leaves `attempts` alone.** `npm run outbox:replay` resets only the row's status, so `app.outbox.attempt` keeps climbing, and a delivery whose attempt follows a `failed` one is visibly a replay. There is no separate replay attribute.
- **Attribute keys live in one place**: `src/shared/infrastructure/tracing/attributes.ts` exports each key as a constant, which `traced`, the relay and the metrics facade import, so no call site spells a key as a string literal. Both force it: lint bans span writes outside `tracing/`, and the helpers there accept only the closed `AppAttributes` type ([ADR 0017](./0017-telemetry-keeps-user-input-out-by-construction-except-error-messages.md)). _(Amended by the no-user-input enforcement decision.)_

## Considered Options

- **Path-shaped names** (`boards/commands/moveTask`). Rejected. They repeat the file layout and the command/query split, which a reader of a trace rarely needs.
- **Bare export names** (`moveTask`). Rejected. They collide across modules.
- **A custom ESLint rule that checks the literal equals the export name.** Rejected for now. It would be the template's first custom rule, to catch a mistake review sees at a glance.
- **An `app.use_case` attribute.** Rejected. It duplicates the span name.
- **Recording aggregate ids on request spans.** Rejected. It needs per-feature code ([ADR 0008](./0008-error-classes-thrown-outages-and-an-edge-mapper-in-app.md) rejected a tracer port for the same reason) or reflection over inputs, which risks recording user input.
- **`actorId` / `user.id` on spans.** Rejected for the personal-data reasons above.
- **OTel messaging semantic conventions** for relay spans (`messaging.system`, `process <destination>`). Rejected. The outbox is an in-process table, not a broker, and naming a messaging system would mislead anyone reading the trace.
- **A drain span for every poll.** Rejected. Most polls find nothing, and each would be an empty trace.
- **Resetting `attempts` on replay, with an `app.outbox.replayed` attribute.** Rejected. Keeping the count says the same thing with one attribute fewer, and keeps the row's full history.

## Consequences

- The `app.*` attribute keys and the relay span names are a contract with dashboards and alerts. Renaming one means a new ADR.
- `traced` span names are not frozen. Renaming a use case's export renames its span, and any saved query on the old name breaks with it.
- A backend can group request spans by `app.module` and relay work by `app.outbox.name` without parsing names.
- Without the actor or input ids on request spans, finding "every request user X made" needs the app's own logs or audit, not traces.
