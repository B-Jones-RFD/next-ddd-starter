# Research: diagnostic logger options and trace correlation

Ticket: [#32](https://github.com/B-Jones-RFD/next-ddd-starter/issues/32). Map: [#30](https://github.com/B-Jones-RFD/next-ddd-starter/issues/30).
Researched 2026-11-01 against Next.js 16.4.3 (the docs bundled in `node_modules/next/dist/docs/`) and Node v26.11.1. Package versions are the npm `latest` tags on that date.

**Diagnostic log** here means technical and operational logging. It is never the audit log.

## Answer

Use **pino** for diagnostic logs, behind a small facade in `src/shared/infrastructure/logging/`. It should:

1. **Inject correlation with pino's `mixin`.** The mixin reads `trace.getActiveSpan()?.spanContext()` from `@opentelemetry/api` and adds `trace_id`, `span_id` and `trace_flags`. Don't rely only on `@opentelemetry/instrumentation-pino` for this. That instrumentation patches the module loader, and I confirmed it silently injects nothing when pino is loaded through ESM `import` without a loader hook (see the smoke test below). A mixin works the same however pino gets loaded.
2. **Write NDJSON to stdout by default**, using pino's main-thread destination (no worker transport). Stdout is the vendor-neutral baseline, and a collector or platform can pick it up.
3. **Make OTLP log export opt-in by env**, through `@opentelemetry/instrumentation-pino`'s "log sending". It runs on the main thread and uses the same SDK `LoggerProvider` as the traces. Pass `disableLogCorrelation: true` if the mixin already adds the ids, or set the instrumentation's `logKeys` to match the mixin's field names. Avoid `pino-opentelemetry-transport`: it runs a separate `LoggerProvider` in a worker thread and pins an older OTel line.
4. **In dev, pretty-print with `pino-pretty`**, either as a transport (it's on Next's default external list, so the worker can resolve it) or as a main-thread stream.
5. **Use pino `redact` paths as defense in depth.** The primary control is still the settled rule that error data is limited to codes, ids and field names, never user input.

The OTel Logs API is the export pipe, not the logger. Its `Logger.emit` is documented as "should only be used by log appenders". A plain `console` JSON wrapper is the fallback if the template wants zero logging dependencies, but it means reimplementing redaction, levels and pretty output by hand.

## Comparison

| | pino 10.4 (+ mixin, optional instrumentation-pino) | OTel Logs API/SDK directly | Small JSON `console` wrapper |
|---|---|---|---|
| Trace/span id injection | `mixin` reading `@opentelemetry/api` (always works). instrumentation-pino adds `trace_id`/`span_id`/`trace_flags` automatically, but only when its loader hook catches the pino load | The SDK `Logger.emit` attaches the active span context automatically [S6] | Hand-written: read `trace.getActiveSpan()` |
| Redaction | Built in: `redact` paths, `censor`, `remove` [S3] | None. Write a `LogRecordProcessor` | Hand-written |
| Dev pretty-print | `pino-pretty` [S4] | `ConsoleLogRecordExporter` only: `console.dir` of objects, "output... may change at any time" [S7] | Hand-written |
| OTLP log export | Via instrumentation-pino log sending (main thread, shared SDK) [S1], or pino-opentelemetry-transport (worker) [S9] | Native: `exporter-logs-otlp-http/grpc/proto`, `OTEL_LOGS_EXPORTER` [S8] | Only by also calling the OTel Logs API, which turns it into the second option |
| Intended audience | Application logging | Bridge for "log appenders", not for direct app use [S5][S6] | — |
| Install size (measured, fresh `npm i`) | pino: 13 packages, 2.3 MB. pino-pretty: +1.6 MB. instrumentation-pino + api: 13 MB | sdk-logs + exporter-logs-otlp-http + api: 18 MB | 0 |
| Next bundling | `pino`, `pino-pretty`, `pino-roll` and `thread-stream` are on Next's default `serverExternalPackages` list, so no config is needed [N2] | Load it only from `instrumentation.node.ts` behind `NEXT_RUNTIME === 'nodejs'` [N3] | None |

## Findings and sources

### Trace correlation

- **What instrumentation-pino does** [S1]. It injects `trace_id`, `span_id` and `trace_flags` into records logged inside an active span ("log correlation"), following the OTel logging trace-context compatibility spec. It also adds a destination that forwards records to the SDK `LoggerProvider` ("log sending"), which is a no-op if no provider is registered. Both features can be turned off (`disableLogCorrelation`, `disableLogSending`), and the field names can be changed with `logKeys`. It supports `pino >=5.14.0 <11`. Version 0.70.0 needs Node `>=22.15.0`, and through `@opentelemetry/instrumentation@0.300.0` it needs a peer `@opentelemetry/api >=1.10.0 <1.11.0`.
- **How it works, and its limits** [S2]. `@opentelemetry/instrumentation` hooks module loading through `require-in-the-middle` and `import-in-the-middle`. It needs two things: the instrumentation must be registered before the module is required, and the module must not be bundled. An ESM `import` needs the loader hook `@opentelemetry/instrumentation/hook.mjs` to be registered. The README calls ESM support "experimental".
- **Smoke test (Node 26.11.1, pino 10.4.0, instrumentation-pino 0.70.0, sdk-node 0.300.0)**, with a span active:
  - `require('pino')` (CJS): ids injected, and `redact` applied.
  - `await import('pino')` (ESM) with no hook: **no ids, and no error or warning**.
  - ESM with `--import @opentelemetry/instrumentation/hook.mjs`: no ids, because that file isn't a self-registering `--import` entry.
  - ESM with `--experimental-loader=@opentelemetry/instrumentation/hook.mjs`: ids injected, plus an ExperimentalWarning that recommends `module.register()`.
- **Implication for Next.** The Next docs say an external package is loaded "with native Node.js `require`" [N2], and pino is a CommonJS package. So under `next start` the require hook *should* catch it, as long as the SDK is started in `register()` before any module imports pino. **I did not verify this.** I didn't build a Next app with pino, and I couldn't inspect how Turbopack emits external loads, because that code lives in the native binary. This is why the recommendation makes the mixin the source of correlation and treats the instrumentation only as the exporter.
- **The OTel SDK Logger attaches context itself.** `sdk-logs@3.0.0`'s `Logger.emit` uses `logRecord.context || context.active()` and copies a valid span context onto the record [S6]. The same happens for any appender, including instrumentation-pino's log sending, so exported OTLP records carry trace and span ids even when no fields are injected into the JSON.
- **Logs outside a request have no trace id.** The Next OTel guide says spans created during `instrumentation` load or inside `register` don't join a request trace [N3]. The outbox relay is started from `instrumentation.ts` (ADR 0007), so its log lines will have no `trace_id` unless each drain or delivery runs in its own span. That decision belongs to the outbox propagation ticket.

### OTel Logs API status (version-sensitive)

- The **Logs API is now in `@opentelemetry/api` 1.10.0** (released 2026-10-20). It exports `logs`, `SeverityNumber`, `Logger` and `LoggerProvider`, and `logs` is marked `@since 1.10.0` [S5]. The `api-logs` README said this would happen once the API stabilized, after which `@opentelemetry/api-logs` would be deprecated. Version 0.223.0 is still published, and npm shows no deprecation flag yet.
- **The OTel JS 3.0 / 0.300 line is about 12 days old.** That covers `sdk-logs@3.0.0`, `sdk-node@0.300.0`, `exporter-logs-otlp-http@0.300.0` and `instrumentation@0.300.0`, all with Node `>=22.15.0` and peer `@opentelemetry/api >=1.10.0 <1.11.0` [S6][S8].
- **`@vercel/otel@2.2.0` is incompatible with that line.** Its peer ranges are `api-logs`/`sdk-logs`/`instrumentation >=0.200.0 <0.300.0` and `resources`/`sdk-trace-base`/`sdk-metrics >=2.0.0 <3.0.0` (from `npm view`). The Next guide installs `@vercel/otel` with `@opentelemetry/sdk-logs` and `@opentelemetry/api-logs` [N3]. Choosing `@vercel/otel` therefore pins the template to the 2.x/0.2xx line, and choosing `NodeSDK` 0.300 rules out `@vercel/otel` until it updates. This is for the OTel setup ticket to settle, and whatever logger is chosen has to match it.
- `pino-opentelemetry-transport@4.0.2` depends on the `0.220` / `resources 2.x` line (gRPC, HTTP and proto exporters all bundled). Installing it with pino came to 61 packages and 47 MB. It also runs its own `LoggerProvider` in a worker that is "independent of any OpenTelemetry SDK components in the main thread" [S1][S9].
- `sdk-node` reads `OTEL_LOGS_EXPORTER` (`otlp`, `console`, `none`; default `otlp`) and `OTEL_EXPORTER_OTLP_LOGS_PROTOCOL` (default `http/protobuf`) [S8]. This fits the map's "OTLP configured by env, console or no-op in dev and mock mode".
- `sdk-logs` has an **experimental** `LoggerConfigurator` with `minimumSeverity` and `traceBased` (drops logs from unsampled traces) [S6]. It's relevant to the sampling ticket, and its API may change.

### Redaction

- pino `redact` accepts an array of paths, or `{ paths, censor, remove }`. Wildcards like `a[*].b` are supported. `censor` can be a string or a function [S3]. The API docs warn: "Never allow user input to define redacted paths."
- The smoke test confirmed `redact: ['secret']` produces `"[Redacted]"`.
- **Stale docs:** pino's redaction docs still say it's built on `fast-redact`, but `pino@10.4.0` depends on `@pinojs/redact@^0.4.0`. The path syntax described matches what I saw, but double-check performance claims and caveats against `@pinojs/redact`.

### Dev pretty-printing

- pino writes NDJSON by default. For dev, use `pino-pretty` as `transport: { target: 'pino-pretty' }` [S4]. Transports run in a worker thread through `thread-stream`, and `logger.flush()` does not flush `pino-pretty`'s output [S4].
- Next's default external list includes `pino-pretty`, with the comment "A 'plugin' that is passed to pino as a string (and is then required in a worker)", and also `thread-stream` [N2]. So the dev transport needs no `serverExternalPackages` entry.
- The same toggle could swap stdout JSON for pretty output in mock mode and tests, or silence logs entirely (`level: 'silent'`).

### Next bundling and `serverExternalPackages`

- `serverExternalPackages` opts dependencies used in Server Components and Route Handlers out of bundling, so they load "with native Node.js `require`" [N1].
- Next's default list already includes `pino`, `pino-pretty`, `pino-roll`, `thread-stream`, `require-in-the-middle` and `import-in-the-middle` [N1]. Next's source list explains `pino`: its `lib/transport.js` passes `join(__dirname, 'worker.js')` to thread-stream, which fails with "Cannot find module ... pino/lib/worker.js" when pino is bundled [N2]. pino's own bundling doc says the same thing: a bundler has to emit the worker files separately and set `globalThis.__bundlerPathsOverrides` [S10].
- `@opentelemetry/*` packages are not on the default list. The Next OTel guide's pattern loads them only from `instrumentation.node.ts`, behind `process.env.NEXT_RUNTIME === 'nodejs'`, because `NodeSDK` doesn't work in the edge runtime [N3].
- Next resolves `@opentelemetry/api` from the app if it's installed, and otherwise uses its own compiled copy (`dist/server/lib/trace/tracer.js`, and the `hasExternalOtelApiPackage` alias in `dist/build/create-compiler-aliases.js`). The template should install `@opentelemetry/api` itself, so that Next's spans, `traced()` and the logger mixin all share one global API.
- **Not verified:** whether `output: 'standalone'` file tracing includes transport targets that are named only as strings (`'pino-pretty'`). If pretty-printing is dev-only, it doesn't matter.

### Interaction with Next's `logging` config

- `logging` only controls what **Next itself prints to the terminal during development** [N4]:
  - `fetches` (with `fullUrl` and `hmrRefreshes`)
  - `serverFunctions`: on by default; it prints each Server Function's name, **arguments** and duration
  - `incomingRequests`: an ignore list or `false`; "only logged in development, this option doesn't affect production builds"
  - `browserToTerminal`: forwards browser console output, default `'warn'`
  - `logging: false`: turns off the dev logging
- It does not capture, format or route application logs, so it neither conflicts with nor integrates with pino, the OTel SDK or a console wrapper. In dev, both write to the same terminal.
- **Note for the "never user input" rule:** `logging.serverFunctions` (default on) prints Server Function arguments, which are user input, in the dev terminal. It's dev-only and not a diagnostic log, but the config ticket could choose `serverFunctions: false` to keep dev output consistent with the rule.
- `browserToTerminal` concerns client logs, which are out of scope for #30.

### Cost and compatibility on Node 26

- pino 10.4.0 is CommonJS (`"type": "commonjs"`) and ships its own types. In the smoke test it ran on Node 26.11.1 under both `require` and ESM `import`. Its LTS doc says it supports the Node lines that are current or LTS when a pino line is released. **But that doc's schedule table stops at 9.x (Node 18/20/22) and doesn't list 10.x or Node 26**, so Node 26 support rests on the policy and my smoke test, not on a published row.
- Asynchronous `pino.destination({ sync: false })` can lose buffered lines on a crash or when a serverless runtime freezes, so use `sync: true` on such platforms [S11]. For a long-running `next start`, the default destination is fine.
- Install sizes are in the comparison table. They were measured with `npm install --ignore-scripts` into an empty project, so they include transitive dependencies.

## Open caveats

1. **Unverified:** that instrumentation-pino's require hook catches pino under `next start` with Turbopack. The mixin design makes this matter only for OTLP log sending. Spike it in the implementation ticket: one Route Handler logging inside a span, with `OTEL_LOGS_EXPORTER=console`.
2. **OTel line choice:** `@vercel/otel` (0.2xx/2.x) versus `NodeSDK` (0.300/3.x, released 2026-10-20). This decides which `instrumentation-pino` and `sdk-logs` versions fit. Defer to the OTel setup ticket.
3. **Relay logs** have no trace id unless the relay creates spans (outbox propagation ticket).
4. **pino docs are partly stale**: the LTS table lacks 10.x, and the redaction docs name `fast-redact`.
5. `ConsoleLogRecordExporter` output format isn't stable [S7]. Don't build dev tooling on it.

## Sources

Next.js (bundled docs and source, `next@16.4.3`):
- [N1] `node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/serverExternalPackages.md`
- [N2] `node_modules/next/dist/lib/server-external-packages.jsonc` (the source list behind N1, with comments). Upstream: https://github.com/vercel/next.js/blob/canary/packages/next/src/lib/server-external-packages.jsonc
- [N3] `node_modules/next/dist/docs/01-app/02-guides/open-telemetry.md`
- [N4] `node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/logging.md`

Packages (READMEs and dist read from the published npm tarballs):
- [S1] `@opentelemetry/instrumentation-pino@0.70.0` README. https://www.npmjs.com/package/@opentelemetry/instrumentation-pino
- [S2] `@opentelemetry/instrumentation@0.300.0` README ("Instrumentation for ECMAScript Modules", "Limitations"). https://www.npmjs.com/package/@opentelemetry/instrumentation. ESM notes: https://github.com/open-telemetry/opentelemetry-js/blob/main/doc/esm-support.md
- [S3] `pino@10.4.0` `docs/redaction.md` and `docs/api.md#opt-redact`. https://getpino.io/#/docs/redaction
- [S4] `pino@10.4.0` `docs/pretty.md` and `docs/asynchronous.md`. https://getpino.io/#/docs/pretty
- [S5] `@opentelemetry/api@1.10.0` `dist/logs-api.d.mts`, `dist/index.d.mts`, and the `@opentelemetry/api-logs@0.223.0` README. https://www.npmjs.com/package/@opentelemetry/api-logs
- [S6] `@opentelemetry/sdk-logs@3.0.0` README and `dist/Logger.mjs`; `@opentelemetry/api@1.10.0` `dist/logs/Logger.d.mts` ("should only be used by log appenders"). https://www.npmjs.com/package/@opentelemetry/sdk-logs
- [S7] `@opentelemetry/sdk-logs@3.0.0` `dist/export/ConsoleLogRecordExporter.mjs`
- [S8] `@opentelemetry/sdk-node@0.300.0` README (env vars table). https://www.npmjs.com/package/@opentelemetry/sdk-node
- [S9] `pino-opentelemetry-transport@4.0.2` README. https://github.com/pinojs/pino-opentelemetry-transport
- [S10] `pino@10.4.0` `docs/bundling.md` and `docs/transports.md`. https://getpino.io/#/docs/bundling
- [S11] `pino@10.4.0` `docs/asynchronous.md` and `docs/lts.md`. https://getpino.io/#/docs/lts

Versions, engines and peer ranges come from `npm view` on 2026-11-01. The smoke-test scripts were throwaway and are not committed.
