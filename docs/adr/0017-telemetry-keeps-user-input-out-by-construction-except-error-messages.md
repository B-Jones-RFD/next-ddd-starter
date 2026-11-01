# Telemetry keeps user input out by construction, except error messages

Spans and diagnostic logs carry codes, ids and field names, never user input ([ADR 0008](./0008-error-classes-thrown-outages-and-an-edge-mapper-in-app.md)). That rule is enforced statically. Closed types fix which span attributes and log fields exist, lint fixes who may write them, and review checks that each value is a code, an id or a field name. Nothing scrubs values at runtime. Error messages are the one accepted gap: third-party messages are kept as they are, and Next records thrown errors on its own spans. We chose this because pattern-based scrubbing misses free text and mangles ids, while fixed keys and a single writer leave review one small question per call site. We kept third-party messages because they are what an operator needs to diagnose an outage.

## Decisions

- **Span data is written only in `src/shared/infrastructure/tracing/**`.** Lint (`no-restricted-syntax`) bans calls to `.setAttribute`, `.setAttributes`, `.addEvent`, `.recordException` and `.setStatus` everywhere else. `traced`, the relay and the metrics facade call typed helpers from that module.
- **`AppAttributes` is a closed type** in `tracing/attributes.ts`: a map from each `app.*` key ([ADR 0016](./0016-span-names-and-app-attributes-are-a-contract.md)) to its value type, with no index signature. The helpers accept only `Partial<AppAttributes>`, so a new attribute means adding a key to that type on purpose.
- **Log fields are typed per event.** The closed `LogEvent` union ([ADR 0013](./0013-diagnostic-logs-are-written-by-infrastructure-and-the-edge-through-one-facade.md)) maps to a `LogEventFields` type, and `logger.<level>(event, fields)` accepts exactly `LogEventFields[event]`. There is no shared field bag, and no event takes extra keys.
- **`AppError` keeps its `message` parameter**, and the rule lives in `AppError`'s doc comment: a message is constant text plus codes, ids and field names (`` `Task ${taskId} not found` ``), never a value from input. Review enforces it. There is no lint rule, because a selector can't tell an id from input.
- **`err` serializes a fixed list of properties**: `type`, `message`, `stack`, `code`, `retryable` and the data properties declared on `AppError` subclasses, along each link of the `cause` chain. It is a custom serializer, never pino's `stdSerializers.err`, which copies every enumerable property and would carry whatever a library attaches (request config, headers, response bodies). `traced` records a thrown error with the same list.
- **No pino `redact`.** Closed field types and the fixed `err` list leave it nothing to match, and it can't clean text inside a message.

## Accepted risk

- **Third-party messages are kept as they are**, `cause` chain included. A library's message can quote values: an external SDK may put a URL with a query string in its message, and `JSON.parse` and `new URL` quote their input. SQLite's messages name columns and constraints, not values.
- **Next's spans record thrown errors.** Next calls `recordException(err)` and sets the status message to `err.message` on its own spans, so whatever a thrown error says reaches the trace even outside `traced`. Only outages (`AppError`s, bound by the message rule) and bugs are thrown. Edge input goes through Zod `safeParse`, which returns a result and doesn't throw.
- An app that exports to a vendor backend and calls libraries whose errors echo request data should wrap those errors in its adapter and keep a reduced `cause` (status, library code).

## Considered Options

- **Review only.** Rejected. Nothing would stop a new attribute key or log field from appearing silently.
- **Runtime scrubbing** (a span processor or redaction that removes values matching emails or free text). Rejected. It guesses from patterns, misses most input and removes ids.
- **`AppError` without a message parameter**, deriving `message` from the class and code. Rejected. It loses the context that makes a developer message useful.
- **Adapters reduce every third-party cause, or the serializer drops non-`AppError` messages.** Rejected. It removes the text needed to diagnose an outage, to guard against a risk the template's own adapter (SQLite) doesn't have.
- **Rewriting Next's spans** with a wrapping exporter. Rejected. `onEnd` spans are read-only by API, and the risk it removes is small.

## Consequences

- Adding a span attribute or a log field is a type change in one module, which makes it visible in review.
- Telemetry exported to a vendor backend can still hold input quoted by a third-party error message. That is a documented gap, not a guarantee.
