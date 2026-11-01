# Outbox backlog gauges are the only metrics the template ships

The template ships three OpenTelemetry metrics, all observable gauges describing the state of each outbox's backlog, and nothing else. Spans already record every event the relay and the request path produce: deliveries, retries, drain cycles and request rate, errors and duration. A backend can derive counts and durations from those spans. What spans and logs can't express is state. A stalled stream emits nothing, and a `failed` row is logged once ([ADR 0013](./0013-diagnostic-logs-are-written-by-infrastructure-and-the-edge-through-one-facade.md)) and then sits until someone replays it. These gauges cover exactly that gap: "audit is N minutes behind" and "3 rows need a replay" are what an alert would watch.

## Decisions

- **Instruments**, read per outbox at collection time, each with one attribute, `app.outbox.name`, set to the owning module (`boards`, `identity`, …). Ids never go on metric attributes, so cardinality stays bounded.

  | Instrument                      | Kind             | Unit    | Meaning                                                   |
  | ------------------------------- | ---------------- | ------- | --------------------------------------------------------- |
  | `app.outbox.pending`            | observable gauge | `{row}` | rows neither delivered nor `failed` (includes retrying)   |
  | `app.outbox.oldest_pending.age` | observable gauge | `s`     | age of the oldest pending row, `0` when none are pending  |
  | `app.outbox.failed`             | observable gauge | `{row}` | rows marked `failed`, waiting for `npm run outbox:replay` |

- **Source of the values**: a `backlog()` method on `IOutbox` that returns the pending count, the oldest pending row's timestamp, and the failed count. It is implemented by the SQLite adapter and the `.mock.ts` twin, and the outbox contract suite pins it ([ADR 0012](./0012-tests-go-through-api-on-mock-adapters-kept-honest-by-contract-suites.md)). The relay does not keep in-memory counts, because those would be wrong after a restart and would miss `failed` rows from an earlier run.
- **Facade**: `src/shared/infrastructure/metrics/` starts with `import 'server-only'` and exposes `getMeter()`, a function, not a module-level constant. Unlike tracing, `@opentelemetry/api`'s metrics API has no proxy provider. A meter obtained before `NodeSDK.start()` comes from `NOOP_METER_PROVIDER` and stays a no-op forever. The facade's doc comment says that instruments must be created after `register()` has started the SDK.
- **Who may import it**: `src/shared/infrastructure/**`, each module's `infrastructure/`, `src/di/**` and the instrumentation shims. `no-restricted-imports` bans `metrics` from `@opentelemetry/api` (and the SDK metrics packages) everywhere except the facade and `src/instrumentation.node.ts`. Domain and application never import OTel.
- **Registration**: once, by the relay's start, which already runs from `register()` after the SDK ([ADR 0007](./0007-one-aggregate-per-transaction-with-a-transactional-outbox.md)) and already knows every outbox it drains. A single observable callback calls `backlog()` on each outbox.
- **Reader wiring**: chosen by `OTEL_METRICS_EXPORTER`, with the same values as the span processor ([ADR 0015](./0015-observability-is-configured-by-standard-otel-env-with-safe-defaults.md)). _(Amended by the env surface decision.)_
  - `otlp`: a `PeriodicExportingMetricReader` with the OTLP http/protobuf metric exporter.
  - `console`: the same reader with the console exporter.
  - `none` (the default): `metricReaders: []`.

  Both readers use the 60 s default interval, overridable with the standard `OTEL_METRIC_EXPORT_INTERVAL` and `OTEL_METRIC_EXPORT_TIMEOUT`. Unlike traces, "off" here really means no reader. Nothing depends on a metric existing the way the `unexpected` reference depends on a trace id. The callbacks never run, so dev and mock mode never query the outbox for metrics.

- **Tests**: the outbox contract suite covers `backlog()` for pending, retrying, failed and delivered rows and the oldest age. One unit test builds its own `MeterProvider` with an in-memory reader, registers the gauges over two mock outboxes, calls `collect()`, and checks one data point per outbox with the right attribute. The Vitest setup gets no global test meter, and nothing is added per feature.

## Considered Options

- **No metrics at all.** Rejected. Backlog depth, backlog age and failed rows are state, not events, so neither spans nor logs can carry them, and they are the signals that tell you the audit log is falling behind.
- **Event metrics too** (delivery and retry counters, drain-duration histogram). Rejected. They repeat what delivery spans already hold, and a backend derives them from spans.
- **Request (RED) metrics** through an HTTP metrics instrumentation. Rejected. Next records every request as a span and emits no metrics. A collector `spanmetrics` connector or the vendor derives rate, errors and duration, which matches the "no access log, traces cover it" decision in ADR 0013.
- **Node runtime and host metrics** (`instrumentation-runtime-node`, `host-metrics`). Rejected for the template. Every vendor has an opinion on them, and they add dependencies to an SDK that is still churning. Once a reader exists, adding them takes one line in `instrumentation.node.ts`.
- **Calling `@opentelemetry/api` directly from the relay.** Rejected. It would leave no single place for lint to allow, and an app adding its own metrics would have no obvious starting point.

## Consequences

- `IOutbox` gains `backlog()`, and both adapters and the contract suite grow to match.
- `NodeSDK` is constructed with a reader chosen by env in place of the research sketch's fixed `metricReaders: []`. ADR 0015 names the variables.
- An app that wants RED, runtime or domain metrics adds them through the same facade, after the SDK starts.
- Instrument names and the `app.outbox.name` attribute are a contract for dashboards and alerts. Renaming one means a new ADR.
