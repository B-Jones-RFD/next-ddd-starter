# Functional core, class adapters behind `I*` ports, resolved with `getInjection` in a mock-capable container

The domain and use cases are pure functions and types. Only adapters are classes, and each implements an `I*`-prefixed port interface (`class BoardRepository implements IBoardRepository`). These ports are the only exception to the repo's no-`I`-prefix and `type`-over-`interface` rules. Every adapter has a working in-memory twin next to it (`board-repository.mock.ts`). The ioctopus container in `src/di/` binds **only adapters**: repositories, services and external dependencies that need a mock for development and testing. Use cases are never bound. Each command and query is a plain exported function that calls `getInjection('IPortName')` from `@/di/container` inside its body, never at module top level. The container decides the mode once at startup: `ADAPTERS` wins if set, `NODE_ENV=test` means mock, a dev environment missing required variables means mock with a warning, and production refuses to start in mock mode. This lets the dev server run with no database, while making sure production never quietly runs on fakes.

`src/di/` holds `container.ts` (creates the container, picks the mode, exports `getInjection`), `types.ts` (maps each token to its port type with type-only imports, so `getInjection('IBoardRepository')` returns `IBoardRepository`), and `modules/` with one bindings file per context plus `shared.module.ts`. A token is the port's interface name and must be unique across the repo.

## Considered Options

- **Classes for aggregates and use cases.** Rejected. Aggregates would have to collect events internally and expose `pullEvents()`, which undoes the `{ state, events }` return. Class instances also break at Next's serialization boundaries (Client Component props, Server Action results, `'use cache'`). Use-case classes bring the `this`-binding trap when `execute` is passed around.
- **Use-case factories (`makeCreateTask(deps)`) wired by the container.** This was the first choice. Rejected because it makes the container wire application code as well as adapters, and it forces a facade or a pre-wired export for every use case before `app/` can call it. With `getInjection`, a module's `api.ts` re-exports its functions directly.
- **Each module owning its own ioctopus module next to its code.** Rejected in favour of `src/di/modules/<context>.module.ts`. This keeps DI knowledge out of modules, apart from their `getInjection` calls.
- **Inversify.** It was the initial preference. Rejected because it always loads `reflect-metadata` and patches the global `Reflect`, even with no decorators, and its docs still require the legacy decorator flags that Next advises against.
- **A hand-written composition root.** It would need no dependencies, but ioctopus (0 dependencies, no decorators, no reflect-metadata, built with Next in mind) was chosen to keep wiring in one declarative place.
- **Mocks only in `tests/`.** Rejected, because the dev server must be able to load them.

## Consequences

- `getInjection` is a service locator. `application/` may import `@/di/container` and nothing else under `src/di/`. Because the container loads the bindings, which load infrastructure, there is a runtime dependency from `application/` outward, even though every type still points inward to ports. This is deliberate, and `standards.md` says so, so it isn't mistaken for a layering bug. `domain/` never imports `@/di/**`, and `app/` never does either.
- Resolving inside the function body means importing `api.ts` never builds the container, the mode is always decided before anything resolves, and tests can swap bindings between cases.
- A use case's dependencies are no longer visible in its signature. You read them from its `getInjection` calls.
- The composition-level catch-all for unexpected errors in [ADR 0005](./0005-ports-declare-their-errors-and-composition-catches-the-rest.md) can no longer wrap use cases at binding time. Where it moves is decided in its revision.
- Mocks ship in the production bundle, but they are only loaded through `import()` when mock mode is selected.
- Mock stores and the database handle are cached on `globalThis` so they survive dev hot reloads. Tests call `resetMockStores()` between cases.
