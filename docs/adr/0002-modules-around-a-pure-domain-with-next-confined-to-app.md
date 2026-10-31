# Modules around a pure domain, with Next confined to `app/`

All deployable code lives in `src/`, and tests live in a top-level `tests/` folder, so a Docker build copies only `src/`. Business code sits in modules (`src/modules/identity`, `src/modules/boards`, `src/modules/audit`), each with `domain/`, `application/` and `infrastructure/`. Each module is a bounded context with its own model and its own `GLOSSARY.md`, indexed by the root `GLOSSARY-MAP.md`. At this size that is more than the app needs. It is deliberate, because this repo is the template for larger, multi-context applications. Next and React are imported only in `src/app/`, which is the entire presentation layer, plus thin `proxy.ts`/`instrumentation.ts` shims. Each module exposes exactly two entry files at its root. `api.ts` (`server-only`) re-exports its commands, queries and their DTO types. `contracts.ts` (type-only) re-exports its versioned integration events, each defined in its own file under `application/contracts/`. `app/` imports a module only through its `api.ts`. Per-folder `no-restricted-imports` rules, generated per context, enforce this. How contexts talk to each other is [ADR 0006](./0006-contexts-integrate-through-consumer-owned-ports-and-published-events.md).

## Considered Options

- **Layer-first folders (`src/domain`, `src/application`, …).** This was the closest published Next example (nikolovlazar/nextjs-clean-architecture). Rejected in favour of modules, because auth code (hashing, sessions) should never share folders with board rules.
- **One context split into modules.** All modules share one glossary and are split only where the language has a seam. This is simpler and enough for this app, but it doesn't show how a large system is cut into contexts, which is what this template is for.
- **A module per aggregate (List, Task, …).** Rejected. Nearly every board rule spans Board, List and Task (membership, tags, archiving, moves). As separate contexts, those pure domain services would become cross-module integration code.
- **A `presentation/` folder inside each module.** Rejected so that Next stays in one folder.
- **One `index.ts` per module exporting everything public**, as in `docs/DDD-ARCHITECTURE.md`. Rejected because lint has to tell the two surfaces apart: other contexts' `application/` may import contracts but not the API.
- **Folders (`contracts/`, `api/`) imported file by file, keeping a no-barrels rule.** Rejected in favour of named entry files. The no-barrels rule was dropped instead.
- **`app/` reaching modules only through `src/composition/`.** Rejected once the container stopped wiring use cases ([ADR 0003](./0003-functional-core-class-adapters-and-mock-mode.md)). There is nothing left in it for `app/` to import.

## Consequences

- The contexts are **identity** (Users and sign-in), **boards** (Boards, Lists, Tasks, Tags, Comments and membership) and **audit** (the Audit log and Activity). Audit is downstream of the other two and never writes back to them.
- Cross-context imports follow these rules:
  - `domain/` imports only its own `domain/` and the shared kernel. Never `@/di/**`, IO or Zod.
  - `application/` imports its own `domain/` and `application/`, the kernel, `@/di/container`, and other contexts' `contracts.ts`. It imports nothing else from another context.
  - `infrastructure/` may also import another context's `api.ts`, but only to implement a port its own context defines, and only its queries. Lint can't tell a query from a command, so the "no commands" half is a written rule in `standards.md`.
  - `app/` imports only `@/modules/*/api`, never `@/di/**`.
  - A module never imports its own `api.ts` or `contracts.ts`. Nothing imports another context's internals.
- Inside `domain/`, each aggregate has its own folder (`board/`, `list/`, `task/`, `comment/`) holding the root, its value objects, `<aggregate>.events.ts`, `<aggregate>.errors.ts` and its repository interface `<aggregate>-repository.port.ts`. Logic spanning aggregates goes in `domain/services/`. The repository interface is part of the aggregate's language even though only `application/` calls it.
- Other ports stay in the module's `application/ports/`. Technical ports every context uses (`IUnitOfWork`, `IClock`, `IIdGenerator`, tracing) live in `src/shared/kernel/ports/`, with their adapters in `src/shared/infrastructure/`.
- Reads follow a light CQRS split. Commands load aggregates through repositories. Queries use read ports that return DTOs directly, skipping the domain. Every query therefore has to take the acting user and enforce board membership itself, because no domain operation is there to do it.
- The shared kernel (`src/shared/kernel`) holds building blocks with no business meaning, and `UserId`. A business type joins it only if every context uses it as an identity. Other ids, such as `BoardId` and `TaskId`, cross contexts only as plain strings in event contracts.
