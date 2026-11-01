# Tests go through `api.ts` on mock adapters, kept honest by contract suites

Most behaviour is tested at the module boundary that `app/` uses: application tests call a module's `api.ts` exports under `NODE_ENV=test`, where the container picks the in-memory adapters ([ADR 0003](./0003-functional-core-class-adapters-and-mock-mode.md)). Those tests are only as trustworthy as the mocks, so every port has one shared contract suite that runs against both its real SQLite adapter (a `:memory:` database with the production migrations) and its `.mock.ts` twin. A mock cannot drift from SQLite without a red test. We chose this because it keeps the bulk of the suite fast and independent of how a module stores things, while still proving the real adapters behave as the mocks claim.

## Decisions

- **Runner**: Vitest, with a `unit` project in the `node` environment (domain, application, contract, and the `to-action-error` edge mapper) and a `ui` project in `jsdom` with React Testing Library. `npm run check` runs `npm test`. Playwright E2E runs separately with `npm run test:e2e`.
- **Tiers**:
  - **Domain**: pure functions, no DI, no mocks. They assert on the returned `{ state, events }` and on rule errors.
  - **Application**: these tests go through `api.ts`. `resetMockStores()` runs in `beforeEach`, and `await relay.drain()` comes before any assertion on downstream effects ([ADR 0007](./0007-one-aggregate-per-transaction-with-a-transactional-outbox.md)). Cross-context flows are tested here.
  - **Contract**: `tests/contracts/<port>.contract.ts` exports `describe<Port>Contract(makeAdapter)`, and a runner file calls it once with each adapter.
  - **UI**: Client Components with logic.
  - **Edge mapper**: `to-action-error` runs in the `unit` project, not `ui`, because it is server code that imports the `server-only` log facade.
  - **E2E**: about five critical flows, against `next build && next start` on a fresh SQLite file. Each test signs up its own users, so the suite never depends on the seed.
- **Membership**: per context, one test calls every query exported from `api.ts` as a non-member and expects `ForbiddenError` or an empty result. It fails if an exported query has no registered case. Queries skip the domain, so this is how the rule holds for queries nobody has written yet.
- **Time**: domain functions take `now` (and new ids) as arguments. Use cases read the real clock, and tests use `vi.setSystemTime()`.
- **Definition of done**: a feature ships with domain tests for each operation and rule error, application tests for each `api.ts` export's happy path and declared errors, a membership case for each query, contract coverage for each port method, UI tests for Client Components with logic, a `to-action-error` case for each new error `code`, and an E2E change only when a critical flow changes. There is no coverage threshold.
- **Layout**: `tests/` mirrors `src/` with `*.test.ts(x)`. Shared builders and `given*` helpers live in `tests/fixtures/`, and E2E specs are `tests/e2e/*.spec.ts`. Domain tests build state with builders. Application tests arrange state through commands, never by writing to mock stores.

## Observability in tests

_(Amended by the "Observability in mock mode and tests" decision.)_

- **Mock mode doesn't change observability.** The adapter mode and the span processor are independent settings. A dev server on mock adapters runs the same `register()`, uses the span processor chosen by env and writes to the same log facade. Mock adapters have no tracing or logging code of their own, and `app.started` reports the adapter mode.
- **A real tracer, in memory.** Vitest never calls `register()`, so the `unit` project's setup file registers a tracer provider with `AsyncLocalStorageContextManager`, `SimpleSpanProcessor` and `InMemorySpanExporter`. Registration is idempotent, because a second global registration fails. `tests/fixtures/spans.ts` exposes `recordedSpans()` and `withTestSpan(fn)`, and the exporter is reset in `beforeEach`.
- **Logs are silent.** Under `NODE_ENV=test` the facade defaults to pino's `silent` level and never loads the `pino-pretty` transport. `LOG_LEVEL` overrides this when debugging a failing test. Tests never assert on log lines ([ADR 0013](./0013-diagnostic-logs-are-written-by-infrastructure-and-the-edge-through-one-facade.md)), so no log spy or capture helper ships.
- **`server-only`** is aliased to an empty module in the `unit` project only. The jsdom `ui` project keeps the real module, so a Client Component test that pulls in server code fails loudly.
- **What gets tested once**:
  - `traced`'s own tests cover three cases. An expected error records its `code` and leaves the status unset. A thrown error sets `ERROR`, records the exception with its `cause` and rethrows the same object. A nested span's parent is the outer one.
  - `to-action-error` runs inside `withTestSpan` and asserts that `reference` equals that span's trace id.
  - Feature work adds no span or log assertions to the definition of done.
- **No active span.** If `to-action-error` has no valid span context, it generates a fresh id in trace-id format (32 hex characters) and writes it on the `action.unexpected` line, so the `reference` still finds the log.

## Considered Options

- **Unit-testing Server Components and Server Actions.** Rejected. Vitest cannot render `async` Server Components, and the Next docs point to E2E for them. Actions are thin by [ADR 0011](./0011-server-components-read-server-actions-write-nothing-cached-per-viewer.md), and their behaviour is covered by the application and E2E tiers.
- **A `failNext(method, error)` hook on every mock, or rebinding the container per test.** Rejected. Mocks ship in the bundle, so test-only hooks would ship too. Instead, outages are injected with `vi.spyOn(getInjection('IPort'), 'method').mockRejectedValueOnce(new PersistenceError(...))`, which relies on mock-mode bindings being singletons. A `ConflictError` is never injected: tests produce a real stale version, and the mock `save` enforces `version` exactly as SQLite does, checked by the contract suite.
- **An `IClock` port.** Rejected. Passing `now` into the domain keeps it deterministic, and a port would be a binding that exists only for tests.
- **A coverage percentage gate.** Rejected. It is easy to game and says nothing about which rules are tested. The definition of done names them.
- **No tracer provider in tests (the global no-op API).** Rejected. `traced`, the outbox's trace links and the `reference` returned by `to-action-error` would have no span context to assert against.
- **Resolving `server-only` with the `react-server` condition in Vitest.** Rejected. Dependencies that Vitest externalizes are resolved by Node, so the condition would also have to reach the worker's `execArgv`, and it changes how React itself resolves. An alias is simpler and works on both paths.
- **The all-zero trace id as the fallback `reference`.** Rejected. Every log line without a span would share it, so it would find nothing useful.
- **Arranging application tests by writing to mock stores.** Rejected. It couples tests to storage and skips the invariants the commands enforce.

## Consequences

- Mock-mode adapters must be resolved as singletons, and every mock must honour the same `version` and ordering rules as its real adapter.
- A query added without a membership case fails `npm run check`.
- E2E needs a browser download and a build, so it stays out of `check`, and `standards.md` must say when to run it.
