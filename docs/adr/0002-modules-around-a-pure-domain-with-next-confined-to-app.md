# Modules around a pure domain, with Next confined to `app/`

All deployable code lives in `src/`, and tests live in a top-level `tests/` folder, so a Docker build copies only `src/`. Business code sits in modules (`src/modules/boards`, `src/modules/identity`), each with `domain/`, `application/` and `infrastructure/`. The modules are not separate bounded contexts. They share one glossary and are split only where the language and rules have a seam. Next and React are imported only in `src/app/`, which is the entire presentation layer, plus thin `proxy.ts`/`instrumentation.ts` shims. `app/` reaches business code only through the wired use cases exported by `src/composition/` and the DTO types they return. Per-folder `no-restricted-imports` rules enforce this.

## Considered Options

- **Layer-first folders (`src/domain`, `src/application`, …).** This was the closest published Next example (nikolovlazar/nextjs-clean-architecture). Rejected in favour of modules, because auth code (hashing, sessions) should never share folders with board rules.
- **A module per aggregate (List, Task, …).** Rejected. Nearly every board rule spans Board, List and Task (membership, tags, archiving, moves). As separate contexts, those pure domain services would become cross-module integration code.
- **A `presentation/` folder inside each module.** Rejected so that Next stays in one folder.
- **A barrel `index.ts` as each module's public API.** Rejected, because the repo bans barrel files. A module's public surface is its `application/commands`, `application/queries` and `application/dto`.

## Consequences

- One module reaches another only through a port defined by the module that needs it. For example, boards defines `IUserDirectory`, and its implementation in `boards/infrastructure/` calls identity's public use cases. Only `infrastructure/` may import another module.
- Reads follow a light CQRS split. Commands load aggregates through repositories. Queries use read ports that return DTOs directly, skipping the domain. Every query therefore has to take the acting user and enforce board membership itself, because no domain operation is there to do it.
- The shared kernel (`src/shared/kernel`) holds building blocks with no business meaning, and `UserId`. A business type joins it only if it is an identifier used across modules.
