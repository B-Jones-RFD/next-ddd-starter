# Functional core, class adapters behind `I*` ports, wired by ioctopus with a mock mode

The domain and use cases are pure functions and types: use cases are factories like `makeCreateTask(deps)`. Only adapters are classes, and each implements an `I*`-prefixed port interface (`class BoardRepository implements IBoardRepository`). These ports are the only exception to the repo's no-`I`-prefix and `type`-over-`interface` rules. Every adapter has a working in-memory twin next to it (`board-repository.mock.ts`). The ioctopus container in `src/composition/` binds either the real or the mock adapters. It decides once at startup: `ADAPTERS` wins if set, `NODE_ENV=test` means mock, a dev environment missing required variables means mock with a warning, and production refuses to start in mock mode. This lets the dev server run with no database, while making sure production never quietly runs on fakes.

## Considered Options

- **Classes for aggregates and use cases.** Rejected. Aggregates would have to collect events internally and expose `pullEvents()`, which undoes the `{ state, events }` return. Class instances also break at Next's serialization boundaries (Client Component props, Server Action results, `'use cache'`). Use-case classes bring the `this`-binding trap when `execute` is passed around.
- **Inversify.** It was the initial preference. Rejected because it always loads `reflect-metadata` and patches the global `Reflect`, even with no decorators, and its docs still require the legacy decorator flags that Next advises against.
- **A hand-written composition root.** It would need no dependencies, but ioctopus (0 dependencies, no decorators, no reflect-metadata, built with Next in mind) was chosen to keep wiring in one declarative place.
- **Mocks only in `tests/`.** Rejected, because the dev server must be able to load them.

## Consequences

- Mocks ship in the production bundle, but they are only loaded through `import()` when mock mode is selected.
- Mock stores and the database handle are cached on `globalThis` so they survive dev hot reloads. Tests call `resetMockStores()` between cases.
