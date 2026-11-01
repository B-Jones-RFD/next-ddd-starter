# OTel SDK setup on Next 16.4 and Node 26

Research for [#31](https://github.com/B-Jones-RFD/next-ddd-starter/issues/31), under the map [#30](https://github.com/B-Jones-RFD/next-ddd-starter/issues/30). Researched on 2026-11-01 against `next@16.4.3`, Node `v26.11.1` and the npm registry as of that date. ADR 0008 (`traced`, error attributes, trace id as the `unexpected` reference) and ADR 0007 (the relay starts from `instrumentation.ts`) are taken as given.

Evidence comes in three kinds, each labelled at the point of use:

- **[doc]**: the Next docs bundled in `node_modules/next/dist/docs/`, or a package README from the npm registry.
- **[src]**: the compiled source of `next@16.4.3` or of `@opentelemetry/sdk-node@0.300.0`.
- **[run]**: a throwaway app (`next@16.4.3`, `cacheComponents: true`, SDK 3.0, Node 26.11.1). It had a `traced()` helper like ADR 0008's, a page, a page that throws, a Route Handler, a Server Action, and a relay-like interval started in `register()`. Spans were printed with parent ids, and the app ran under both `next start` and `next dev`.

## Recommendation

Wire **`NodeSDK` by hand** in `src/instrumentation.node.ts`. `register()` in `src/instrumentation.ts` loads it with a dynamic import when `NEXT_RUNTIME === 'nodejs'`, then starts the relay. Don't use `@vercel/otel`. Always pass the span processor explicitly, chosen by one env var, from these three:

| mode      | processor                                       | when                                    |
| --------- | ----------------------------------------------- | --------------------------------------- |
| `otlp`    | `BatchSpanProcessor(new OTLPTraceExporter())`   | deployed. Endpoint and headers come from the standard `OTEL_EXPORTER_OTLP_*` env vars |
| `console` | `SimpleSpanProcessor(new ConsoleSpanExporter())` | local debugging                         |
| `none`    | `NoopSpanProcessor`                             | default in dev and mock mode            |

Also pass `metricReaders: []` and `logRecordProcessors: []` (or real ones, once those tickets decide) so `NodeSDK` doesn't set up OTLP exporters for metrics and logs on its own.

"Off" must mean a **no-op processor, never no provider**. `OTEL_SDK_DISABLED=true` and `OTEL_TRACES_EXPORTER=none` stop `NodeSDK` from registering a tracer provider at all. Then there are no trace ids, so ADR 0008's `unexpected` reference is empty, and Next emits none of its own spans either. Details are in the sections below.

Sketch (not tested beyond the throwaway app; the env var name is a placeholder for the "Config and sampling" ticket):

```ts
// src/instrumentation.ts
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return
  await import('./instrumentation.node') // SDK first, so relay spans are recorded
  const { startRelay } = await import('@/shared/infrastructure/outbox/start') // placeholder path
  startRelay()
}
export { onRequestError } from './instrumentation.on-request-error' // or inline
```

```ts
// src/instrumentation.node.ts
import { NodeSDK } from '@opentelemetry/sdk-node'
import { BatchSpanProcessor, ConsoleSpanExporter, NoopSpanProcessor, SimpleSpanProcessor } from '@opentelemetry/sdk-trace'
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-proto'

const mode = process.env.APP_TRACES_EXPORTER ?? 'none' // placeholder name
const spanProcessors =
  mode === 'otlp' ? [new BatchSpanProcessor({ exporter: new OTLPTraceExporter() })]
  : mode === 'console' ? [new SimpleSpanProcessor({ exporter: new ConsoleSpanExporter() })]
  : [new NoopSpanProcessor()]

new NodeSDK({ serviceName: process.env.OTEL_SERVICE_NAME ?? 'next-ddd-starter', spanProcessors, metricReaders: [], logRecordProcessors: [] }).start()
```

Note the SDK 3.0 constructor shape `new BatchSpanProcessor({ exporter })` (3.0 code in `sdk-node/dist/utils.cjs` [src]). The 2.x docs show `new BatchSpanProcessor(exporter)`.

Packages: `@opentelemetry/api@~1.10.0`, `@opentelemetry/sdk-node@0.300.x`, `@opentelemetry/sdk-trace@3.x`, `@opentelemetry/exporter-trace-otlp-proto@0.300.x`. `@opentelemetry/semantic-conventions` and `@opentelemetry/resources` are only needed if the resource is built by hand.

## 1. `@vercel/otel` vs hand-wired `NodeSDK`

- The Next guide offers both. `@vercel/otel` is the quick start. Manual `NodeSDK` is "equivalent… but it's possible to modify and extend", and `@vercel/otel` is needed only for Edge runtime support ([doc] `02-guides/open-telemetry.md`, "Manual OpenTelemetry configuration").
- **Version-sensitive: OpenTelemetry JS SDK 3.0 shipped on 2026-10-20, and `@vercel/otel` doesn't support it yet.** `@vercel/otel@2.2.0` (published 2026-10-30) has peer ranges `@opentelemetry/resources >=2 <3`, `sdk-trace-base >=2 <3`, `sdk-logs >=0.200 <0.300` and `instrumentation >=0.200 <0.300` (registry metadata). The current releases are `resources@3.0.0`, `sdk-logs@3.0.0` and `instrumentation@0.300.0`. Installing `@vercel/otel@2.2.0` next to SDK 3.0 fails with `ERESOLVE` [run]. Using it today means pinning the template to the 2.x line.
- **The 2.x line is deprecated.** `@opentelemetry/sdk-trace-node@2.12.0` and `sdk-trace-base@2.12.0` are marked deprecated on npm, with the note "Use @opentelemetry/sdk-trace package". The Next guide's manual example still imports `SimpleSpanProcessor` from `@opentelemetry/sdk-trace-node` ([doc]). On SDK 3.0, import it from `@opentelemetry/sdk-trace` instead [run].
- What `@vercel/otel` adds is mostly Vercel-shaped: Vercel resource attributes, automatic export to a Vercel tracing integration, `fetch` instrumentation, and Edge support ([doc] `@vercel/otel` README). This template runs only on Node, picks no vendor, and is meant to show its seams. The manual setup is about 15 lines and uses only vendor-neutral OTel packages.
- **Revisit if** `@vercel/otel` ships SDK 3.0 support and a template user needs Edge. The switch is local to `instrumentation.node.ts`.

## 2. The spans Next emits, and how `traced` spans nest

Next instruments itself whenever a real tracer provider is registered. `isOpenTelemetryEnabled()` checks that the global provider's delegate isn't a `NoopTracerProvider` ([src] `server/lib/trace/tracer.js`). Next requires `@opentelemetry/api` from the app's `node_modules` first and falls back to its own compiled copy only if that fails ([src] same file). So the app must depend on `@opentelemetry/api` directly, and Next and `traced` then share one global API.

By default only allowlisted span types are emitted (`NextVanillaSpanAllowlist` in [src] `server/lib/trace/constants.js`). `NEXT_OTEL_VERBOSE=1` emits all of them, and `NEXT_OTEL_FETCH_DISABLED=1` turns off the `fetch` span ([doc]). The documented default spans are `[http.method] [next.route]` (root, `BaseServer.handleRequest`), `render route (app) [next.route]`, `executing api route (app) [next.route]`, `fetch …`, `generateMetadata`, `resolve page components`, `resolve segment modules` and `start response` ([doc] "Default Spans in Next.js").

Observed trees [run] (`next start`; the dev tree is identical apart from fewer module-loading spans):

```
GET /                                   next.js  BaseServer.handleRequest   (root)
├─ resolve page components / prepare route module / build component tree …
├─ render route (app) /                 next.js  AppRender.getBodyResult
│  └─ boards.getBoard                   app      ← traced
│     └─ boards.repo.load               app      ← nested traced
└─ start response

GET /api/r                              BaseServer.handleRequest (root)
└─ executing api route (app) /api/r     AppRouteRouteHandlers.runHandler
   └─ boards.getBoard → boards.repo.load

POST /act  (Server Action)              BaseServer.handleRequest (root)
├─ boards.renameBoard                   ← traced, a DIRECT child of the root
└─ render route (app) /act              (re-render after the action)
```

- **Server Actions have no span of their own.** A `traced` call inside an action is a direct child of `POST <route>`. The documented default spans don't mention this ([doc]). If an action span is wanted, the edge has to add one, or `traced` naming has to make the action obvious (left to the span-naming ticket).
- Nesting needs no manual context passing. `startActiveSpan` in `traced` picks up Next's active span through the `AsyncLocalStorage` context manager that `NodeSDK` installs by default ([doc] sdk-node README, "contextManager").
- **Error status:** Next's own spans call `recordException(err)`, set `error.type` and set status `ERROR` with `message: err.message` ([src] `recordSpanError` in `tracer.js`). A thrown error therefore marks `traced` span → Next span → root span as `ERROR` [run]. This bears on the no-user-input rule: whatever is in a thrown error's `message` and stack also reaches Next's spans, not just ours. ADR 0008's "message is developer-only" keeps this safe, but the rule has to hold for every thrown error, not just in `traced`.
- **Startup noise:** `load instrumentation module`, `register instrumentation` and (under `next start`) one `load route module` per route are each emitted as **their own root trace** [run]. Next backdates the instrumentation spans and emits them after `register()` returns ([src] `instrumentation-globals.external.js`). This is harmless. A sampler or processor can drop them if they clutter the backend.
- **Cache Components:** after `register()`, Next wraps the global provider's `getTracer`/`getDelegateTracer` so span creation leaves `workUnitAsyncStorage` ([src] `instrumentation-node-extensions.js`, `extendTracerProviderForCacheComponents`, applied to every app whatever its config). That's one more reason to install the provider **inside** `register()` and not at module top level. With `cacheComponents: true`, a prerendered page calling `traced` built cleanly. At build time `register()` doesn't run (`NEXT_PHASE === 'phase-production-build'` returns early, [src]), so `traced` is a no-op and the trace id is `undefined` in prerendered output [run]. That's correct: a trace id must never be cached (ADR 0011).

## 3. Does `onRequestError` see the active span and trace id?

**Yes, in every case tried** [run]. `trace.getActiveSpan()` inside `onRequestError` returned a recording span whose trace id equalled the id seen by the code that threw.

| failure                                     | `context.routeType` | active span in `onRequestError`    |
| ------------------------------------------- | ------------------- | ---------------------------------- |
| Server Component throws (`/boom`)           | `render`            | `render route (app) /boom`         |
| Route Handler throws                        | `route`             | root (`GET`; renamed to `GET /api/r` at end) |
| Server Action throws (form post)            | `render`            | root (`POST`)                      |
| Server Action fetch with a malformed payload | `action`            | root (`POST`)                      |

- Our own `traced` span has already ended by then, so `onRequestError` sees Next's span, not ours. It shares the trace id, which is all ADR 0008 needs. `to-action-error.ts` (running inside the action) and `onRequestError` read the same trace id.
- The trace id exists **only when a real provider is registered**. With `OTEL_SDK_DISABLED=true`, both the page and `onRequestError` saw `traceId: undefined`. With `NoopSpanProcessor`, both saw a real 32-hex id [run]. Hence the recommendation that "off" means a no-op processor.
- The docs say the error may be React's processed copy and not the original, with `digest` to identify it ([doc] `03-file-conventions/instrumentation.md`). Observed: in RSC renders the error carried a `digest` and was still an `Error` with the original `name`/`message` [run]. Don't rely on `instanceof AppError` holding there. The routeType of a thrown Server Action came back as `render`, not `action`, in the progressive-enhancement form-post case. Treat `routeType` as a hint.
- `onRequestError` is not called for errors a Server Action catches and returns (ADR 0008's `{ ok: false }` path). Those reach telemetry only through `traced`'s attributes.
- Side observation, not OTel: with Cache Components/PPR, the throwing page returned HTTP **200**, because the static shell was already streamed. Next's root span still got `ERROR` status. Don't read failures off `http.status_code`.

## 4. ESM, Node 26 and the `register()` lifecycle

- `register()` is called **once per server instance** and must finish before the server handles requests. It may be async ([doc] `03-file-conventions/instrumentation.md`). The source memoizes it in `registerInstrumentationPromise` ([src]). Under `next dev` it also ran once at startup [run]. Whether editing `instrumentation.ts` in dev re-runs it (which would start a second relay) was not tested. Flag it for the relay ticket and make `startRelay()` idempotent (a `globalThis` guard) to be safe.
- `register()` does **not** run during `next build` ([src] the `NEXT_PHASE` guard), so the relay never starts at build time.
- **Order:** import the SDK, then start the relay. Spans started before the provider is installed are dropped. Spans started in `register()` after the SDK starts "typically become separate root traces" ([doc] `open-telemetry.md`, "Good to know"). Observed: each `relay.drain` is its own root trace [run]. That's correct for a background poll. Linking a drain to the request that wrote the outbox row is the outbox-propagation ticket's job.
- **Runtime split:** follow the docs' pattern of a dynamic `import('./instrumentation.node')` under `NEXT_RUNTIME === 'nodejs'`, since `NodeSDK` isn't Edge-compatible ([doc]). Next calls `register` in every runtime ([doc] `02-guides/instrumentation.md`).
- **Node 26 / ESM:** SDK 3.0 packages declare `engines.node >=22.15.0` (registry), and they publish both CJS and ESM (`@opentelemetry/sdk-trace` `exports` has `require` → `.cjs` and `default` → `.mjs`, [src]). Turbopack bundles `instrumentation.ts` and the OTel packages. They aren't on Next's `server-external-packages.jsonc` list; only `import-in-the-middle` and `require-in-the-middle` are ([src]). The whole setup ran on Node 26.11.1 under both `next start` and `next dev` with no loader flags [run]. The repo's lack of `"type": "module"` is irrelevant because Next compiles the file.
- **No auto-instrumentations.** The sdk-node README warns that most OTel JS docs assume CommonJS and points to `doc/esm-support.md` for ESM ([doc]). Library monkey-patching (`instrumentations: [...]`) needs the target module loaded through Node's own loader, not a bundle, and needs loader hooks for ESM. The template doesn't need it: Next's spans plus `traced` cover the request path. An app that adds, say, an HTTP-client or DB instrumentation would have to externalize that library (`serverExternalPackages`) and verify it. **Untested here.**
- **Shutdown / flush (open):** `BatchSpanProcessor` buffers spans, and the sdk-node README recommends calling `sdk.shutdown()` on `SIGTERM` ([doc]). Next's self-hosting guide says `next start` drains in-flight requests and `after()` callbacks on SIGINT/SIGTERM. Its manual signal hook (`NEXT_MANUAL_SIG_HANDLE`) is documented only for the Pages Router ([doc] `02-guides/self-hosting.md`). Whether a `process.on('SIGTERM', () => sdk.shutdown())` registered in `instrumentation.node.ts` runs before Next exits was **not tested**. Until it is, expect to lose the final batch of spans on shutdown.

## 5. Env-configured vendor-neutral OTLP, plus console and no-op

- `new OTLPTraceExporter()` with no arguments reads the standard `OTEL_EXPORTER_OTLP_ENDPOINT` / `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT`, `…_HEADERS`, `…_PROTOCOL` and so on, per the OTel SDK env spec ([doc] sdk-node README, "OTLP Exporter", which links the spec). `OTEL_SERVICE_NAME` and `OTEL_RESOURCE_ATTRIBUTES` are read by the default env resource detector ([doc] same README, "resource" and "resourceDetectors"). The vendor choice is therefore entirely env, as #30 requires.
- `http/protobuf` is the default OTLP protocol ([doc]), so `exporter-trace-otlp-proto` is the one exporter package to install. gRPC and `http/json` are separate packages, which `NodeSDK` already depends on.
- `NodeSDK` can pick exporters from env alone (`OTEL_TRACES_EXPORTER=otlp|console|zipkin|none`, [src] `utils.cjs`; the README's table omits `console` for traces, but the code accepts it). Its defaults don't suit a template:
  - With nothing set, it **defaults to OTLP for traces, metrics and logs**, all pointing at `localhost:4318` ([src] `getSpanProcessorsFromEnv`, `getMetricReadersFromEnv`, `configureLoggerProviderFromEnv`). Dev and mock mode would then try to export to a collector that isn't running.
  - `none` removes the provider, which loses trace ids (§3).
  - For both reasons, select the processor in code from one app-level env var, as shown in the Recommendation. Default it to `none` (NoopSpanProcessor) and pass `metricReaders: []` / `logRecordProcessors: []` explicitly. `OTEL_EXPORTER_OTLP_*` still configures the exporter itself.
- Mock mode (ADR 0003) and dev should default to `none`, with `console` available on demand. `ConsoleSpanExporter` output is verbose (one object per span). For a readable local tree, `NEXT_OTEL_VERBOSE` and a small custom line exporter like the one in the throwaway app are options, but they're optional.
- Sampling: `NodeSDK` reads `OTEL_TRACES_SAMPLER` / `OTEL_TRACES_SAMPLER_ARG` when no `sampler` is passed ([src] `createSamplerFromEnv`). That's left to the "Config and sampling" ticket.

## Open caveats

1. **Version churn.** SDK 3.0 is less than two weeks old. `@opentelemetry/sdk-node` is still labelled "experimental… may include breaking changes" ([doc] README). Pin exact minors. `@opentelemetry/sdk-node@0.300.0` peers `@opentelemetry/api >=1.10.0 <1.11.0`, so the api has to stay on 1.10.x.
2. **`@vercel/otel`** may gain SDK 3.0 support soon. If so, the Edge argument is the only one left in its favour, and it doesn't apply to this template.
3. **Dev reload of `register()`** and **SIGTERM flush** are untested (§4).
4. **`@opentelemetry/api@1.10` exposes `logs`** (`typeof api.logs === 'object'`; `NodeSDK` calls `api.logs.setGlobalLoggerProvider`, [src]). This matters for the diagnostic-log ticket and wasn't investigated further here.
5. The throwaway app didn't have the repo's `partialPrefetching`, Tailwind loader or `server-only` setup. Nothing in them should touch OTel, but the setup should be re-checked once it lands in the real repo.

## Sources

- `node_modules/next/dist/docs/01-app/02-guides/open-telemetry.md` (next 16.4.3)
- `node_modules/next/dist/docs/01-app/02-guides/instrumentation.md`
- `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/instrumentation.md`
- `node_modules/next/dist/docs/01-app/02-guides/self-hosting.md` (graceful shutdown)
- next 16.4.3 source: `dist/server/lib/trace/tracer.js`, `dist/server/lib/trace/constants.js`, `dist/server/lib/router-utils/instrumentation-globals.external.js`, `dist/server/lib/router-utils/instrumentation-node-extensions.js`, `dist/server/base-server.js`, `dist/server/route-modules/route-module.js`, `dist/lib/server-external-packages.jsonc`
- `@opentelemetry/sdk-node@0.300.0` README and `dist/sdk.cjs`, `dist/utils.cjs`
- `@opentelemetry/sdk-trace@3.0.0` README and exports
- `@vercel/otel@2.2.0` README and `peerDependencies` (npm registry)
- npm registry metadata for `@opentelemetry/{api,sdk-trace-node,sdk-trace-base,resources,sdk-logs,instrumentation,exporter-trace-otlp-*}` (versions, `engines`, `deprecated`)
- OpenTelemetry SDK environment variable spec: https://opentelemetry.io/docs/specs/otel/configuration/sdk-environment-variables/
- OpenTelemetry JS ESM support: https://github.com/open-telemetry/opentelemetry-js/blob/main/doc/esm-support.md
