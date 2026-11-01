# Observability is configured by standard `OTEL_*` env with safe defaults

All observability configuration comes from environment variables. Where the OpenTelemetry spec names one, the template uses the spec's name. The template adds no app-level names of its own. Our code reads and validates the variables, then builds every span processor, metric reader and log processor explicitly. `NodeSDK` is never left to choose from env itself. This lets the template change two things the spec gets wrong for a template: the defaults, and what `none` means for traces. With nothing set, `NodeSDK` exports all three signals over OTLP to `localhost:4318`, so dev and mock mode would export to a collector that doesn't exist. Its `none` also removes the tracer provider, which takes the trace id away from [ADR 0008](./0008-error-classes-thrown-outages-and-an-edge-mapper-in-app.md)'s `unexpected` reference.

## Decisions

- **Variables**:

  | Variable                                                 | Values                                                  | Default            | Read by                                         |
  | -------------------------------------------------------- | ------------------------------------------------------- | ------------------ | ----------------------------------------------- |
  | `OTEL_TRACES_EXPORTER`                                   | `otlp` \| `console` \| `none`                           | `none`             | our config reader                               |
  | `OTEL_METRICS_EXPORTER`                                  | `otlp` \| `console` \| `none`                           | `none`             | our config reader                               |
  | `OTEL_LOGS_EXPORTER`                                     | `otlp` \| `none`                                        | `none`             | our config reader                               |
  | `OTEL_METRIC_EXPORT_INTERVAL` / `…_TIMEOUT`              | milliseconds                                            | 60000 / 30000      | our config reader, passed to the reader         |
  | `LOG_LEVEL`                                              | `error` \| `warn` \| `info` \| `debug` \| `trace` \| `silent` | `info` in production, `debug` in dev, `silent` under test | our config reader |
  | `OTEL_SERVICE_NAME`                                      | string                                                  | `next-ddd-starter` | `NodeSDK` resource, the log facade's `service`  |
  | `OTEL_RESOURCE_ATTRIBUTES`, `OTEL_EXPORTER_OTLP_*`       | per spec                                                | per spec           | `NodeSDK` and the OTLP exporters, untouched     |
  | `OTEL_TRACES_SAMPLER` / `OTEL_TRACES_SAMPLER_ARG`        | per spec                                                | `parentbased_always_on` | `NodeSDK`, untouched                       |
  | `NEXT_OTEL_VERBOSE`, `NEXT_OTEL_FETCH_DISABLED`          | per Next                                                | unset              | Next, untouched                                 |

- **`none` for traces is a `NoopSpanProcessor`.** The tracer provider is always registered, so every request has a trace id. This holds for every value, so that `none` means "export nothing" and never means "no tracing". For metrics, `none` means no reader at all ([ADR 0014](./0014-outbox-backlog-gauges-are-the-only-metrics-the-template-ships.md)). For logs, `none` means instrumentation-pino gets `disableLogSending: true` and no log processor is registered. `console` isn't accepted for logs, because pino already writes NDJSON to stdout.
- **The default is `none` in every environment, production included.** A deployment opts in with `=otlp`. Defaults stay vendor-neutral, and nothing errors while no collector exists. If production starts with traces set to `none`, `app.started` is logged at `warn`, the level [ADR 0013](./0013-diagnostic-logs-are-written-by-infrastructure-and-the-edge-through-one-facade.md) defines for "an unusual setup", so a forgotten opt-in is visible.
- **One pure reader that fails fast.** `readObservabilityConfig(env)` in `src/shared/infrastructure/` parses everything above that our code reads. It mirrors `pickAdapterMode` and is tested once. `instrumentation.node.ts` and the log facade call it. It throws at startup on any unknown value, in every environment. It also throws on `OTEL_SDK_DISABLED=true`, which would remove the provider whatever is passed in code, and its message points to `OTEL_TRACES_EXPORTER=none`. There's no schema library and no general env module. `ADAPTERS` and `DATABASE_PATH` stay with `pickAdapterMode`.
- **Sampling is never set in code.** No `sampler` is passed to `NodeSDK`, so the standard sampler variables apply, and the spec's default is `parentbased_always_on`. A trace that isn't sampled still carries a valid trace id, so the `unexpected` reference survives any ratio. The docs recommend `parentbased_traceidratio` for production volume, but the template doesn't set it.
- **Relay delivery spans are sampled independently of the request they link to.** They are roots in the drain's own trace ([ADR 0007](./0007-one-aggregate-per-transaction-with-a-transactional-outbox.md)), and standard samplers ignore links.
- **The `outbox.row.stuck` threshold stays a 5-minute constant** beside the relay, not an env var. It's an alerting judgement, not a deployment fact, and the `app.outbox.oldest_pending.age` gauge lets a backend alert at any threshold.
- **`.env.example`** lists every variable above with its default. This ADR keeps the full table; `.env.example` mirrors it.

## Considered Options

- **App-level names** (`APP_TRACES_EXPORTER`, …). Rejected. They avoid redefining `none` and the defaults, but they invent a vocabulary that operators and vendor docs don't use. Operators still get the meaning they rely on: `otlp` sends to OTLP.
- **Letting `NodeSDK` read the exporter variables itself.** Rejected. Its defaults export everything to `localhost`, and its `none` loses trace ids.
- **Defaulting production to `otlp`.** Rejected. Every export would fail until a collector exists, and the template would be choosing a deployment shape. Logging `warn` covers the risk of forgetting.
- **Honouring `OTEL_SDK_DISABLED`** with a warning. Rejected. It breaks ADR 0008's `unexpected` reference, and `none` already gives "export nothing".
- **A custom sampler that follows the sampled flag on the stored `trace_context` link.** Rejected. It would be template code every app has to understand, and it changes nothing at the default `always_on`.
- **A configurable stuck threshold.** Rejected for the reasons above.

## Consequences

- With a ratio sampler, a request that was sampled out can produce a sampled delivery span whose link points at a trace the backend never received. The reverse can happen too.
- The template deviates from the OTel spec in two documented ways: the default is `none`, and traces' `none` keeps the provider. An operator who reads only the spec would expect OTLP by default, and the `app.started` line names the processor that was chosen.
- Variable names are a contract with deployments. Renaming one means a new ADR.
