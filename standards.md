# Standards

The rules for building a Next.js app with domain-driven design. They override your defaults. This repository is the worked example, and the site at <https://b-jones-rfd.github.io/next-ddd-starter/> explains each section in depth.

## 0. How to use this file

Site: [overview](https://b-jones-rfd.github.io/next-ddd-starter/)

- **Read this file before you write or review code.** It is short on purpose. The explanations live on the site.
- **This file owns the rules.** The site explains them but never adds or changes one, and the ADRs in `docs/adr/` record the trade-offs behind them. If either disagrees with this file, this file wins, and the other gets fixed in the same change.
- **Older guides are superseded.** Where any earlier architecture document conflicts with this file, follow this file.
- **Each rule ends with how it is enforced:** `lint` (ESLint in `npm run check`), `type` (the compiler), `test` (a test fails) or `review` (only a reviewer catches it). Until the slice that writes the governed code adds its check, a `lint` or `test` rule is enforced by review.
- **_This app's choice; decide per project_** marks an answer that belongs to this app, not to the template. What carries over is the seam named with it.
- **Cite rules by section** (for example "§4 Application"). Rules have no IDs.
- **If you change a rule, edit this file in the same change**, along with the site page for its section.

## 1. Scale and deliberate overkill

Site: [Scale](https://b-jones-rfd.github.io/next-ddd-starter/scale/)

- **Treat the structure as deliberate overkill.** Three bounded contexts with ports, published events and an outbox are more than a task board needs, but this repo is the template for large, multi-context apps. Where simplicity here competes with a pattern that scales, the scalable pattern wins. `review`
- **Don't simplify a pattern away because the app is small.** Apps built from this template copy what they see. `review`
- **Prefer the platform.** Reach for web standards and Node's standard library first (`node:sqlite`, `node:crypto`). Add a package only when it earns its place, chosen on purpose for its area. `review`
- **Per-project choices.** Each is _this app's choice; decide per project_, and keeps the seam named:
  - **Authentication and sessions**: self-built email/password with database sessions. Other apps often use an external directory such as Active Directory. Keep the §9 seam.
  - **Database**: one SQLite file through `node:sqlite`, with raw SQL. Keep the repository ports, one aggregate per transaction and the outbox (§5, §6).
  - **Deployment**: local only. §13 lists what a deployed app adds.
  - **Contexts**: `identity`, `boards` and `audit`, cut from this domain's language. Keep the module shape (§2) and the integration rules (§6).
  - **Theme and interaction details**: dark mode with a System / Light / Dark choice, an 8-color tag palette, no keyboard shortcuts and a "Comment posted" status. Keep the §10 accessibility rules and the seam that the server never reads the theme.

## 2. Layout and boundaries

Site: [Layout](https://b-jones-rfd.github.io/next-ddd-starter/layout/)

- **Put all deployable code in `src/` and all tests in a top-level `tests/`.** A container build then copies only `src/`. `review`
- **Give each bounded context one module**: `src/modules/<context>/` holding `domain/`, `application/`, `infrastructure/`, `GLOSSARY.md`, `api.ts` and `contracts.ts`. Module-first folders keep, for example, password hashing away from board rules. `review`
- **Import Next and React only in `src/app/` and the `src/proxy.ts` / `src/instrumentation.ts` shims.** `app/` is the whole presentation layer, and no module has a `presentation/` folder. `lint`
- **Give each module exactly two entry files.** `api.ts` starts with `import 'server-only'` and re-exports the commands, the queries, their DTO types and the error classes they return. `contracts.ts` is type-only and re-exports the versioned integration events. Lint must tell the two surfaces apart, so there is no single `index.ts`. `lint`
- **Never import a module's own `api.ts` or `contracts.ts` from inside it.** `lint`
- **Follow the import matrix.** Every scope also bans `../`. `lint`

  | Importer                     | May import                                                                                                                 |
  | ---------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
  | `domain/`                    | its own `domain/` and `@/shared/kernel`. No IO, Zod, DI or packages                                                        |
  | `application/`               | its own `domain/` and `application/`, `@/shared/kernel`, `@/di/container`, `zod`, and other contexts' `contracts`          |
  | `infrastructure/`            | its own layers, `@/shared/**`, packages, and other contexts' `api` (queries only) and `contracts`. Never `@/di` or `@/app` |
  | `api.ts`                     | its own `domain/` and `application/`, `@/shared/kernel`, `server-only` and `@/shared/infrastructure/tracing`               |
  | `contracts.ts`               | its own `application/contracts/`, types only                                                                               |
  | `src/app/`                   | `@/modules/*/api`, `@/app/**` and `@/shared/infrastructure/logging`. Never `@/di` or Zod                                   |
  | `src/di/`                    | `@/modules/**` and `@/shared/**`. Never `@/app`                                                                            |
  | `src/shared/kernel/`         | only itself                                                                                                                |
  | `src/shared/infrastructure/` | `@/shared/**` and packages                                                                                                 |

- **Call only another context's queries, never its commands.** Side effects across contexts travel as events (§6). Lint can't tell a query from a command. `review`
- **Keep business types out of the shared kernel**, unless every context uses the type as an identity (`UserId`). The kernel holds building blocks with no business meaning (`Brand`, `Result`, the `AppError` tree, `keyBetween`). Other ids cross contexts only as plain strings in contracts. `review`
- **Put technical ports that every context uses in `src/shared/kernel/ports/`**, with their adapters in `src/shared/infrastructure/`. Every other port belongs to the module that needs it. `review`
- **Bind only adapters in `src/di/`:** `container.ts` picks the mode and exports `getInjection`, `types.ts` maps each token to its port with type-only imports, and `modules/<context>.module.ts` plus `shared.module.ts` hold the bindings. A token is the port's interface name and is unique across the repo. Use cases are never bound. `type`
- **Resolve with `await getInjection('IPortName')` inside the function body**, never at module top level. Importing `api.ts` never builds the container, and tests can swap bindings between cases. `review`
- **The container picks the adapter mode once, at startup.** `ADAPTERS=real|mock` wins. Otherwise `NODE_ENV=test` means mock. In dev, a missing required variable means mock, with a warning. Production refuses mock mode and missing variables. The dev server runs without a database, and production never quietly runs on fakes. `test`
- **Give every adapter a working in-memory `.mock.ts` twin beside it.** The twin keeps real behaviour: version checks, ordering and the same error classes. Mocks load through `import()` only in mock mode, keep their stores on `globalThis` and reset with `resetMockStores()`. `test`

## 3. Domain

Site: [Domain](https://b-jones-rfd.github.io/next-ddd-starter/domain/)

- **Speak the context's language.** Code, UI and docs use the terms in `src/modules/<context>/GLOSSARY.md` (indexed by `GLOSSARY-MAP.md`) and never a synonym it lists under _Avoid_. Add or change a term in the glossary first. `review`
- **Write the domain as immutable types and pure functions, with no classes.** Class instances break at Next's serialization boundaries, and pure functions test without mocks. `review`
- **Return `{ state, events }` from every operation that changes state.** The domain raises events. It never saves, publishes or writes the audit log. `type`

  ```ts
  renameTask(task, actor, title, now): Result<{ state: Task; events: TaskEvent[] }, DomainError>
  ```

- **Keep aggregates small, and refer between them by id only.** One aggregate holding everything would lock it all for every edit. `review`
- **Give each aggregate its own folder** in `domain/`, holding the root, its value objects, `<aggregate>.events.ts`, `<aggregate>.errors.ts` and `<aggregate>-repository.port.ts`. Logic spanning aggregates goes in `domain/services/*.service.ts`. The repository interface is part of the aggregate's language. `review`
- **Check permissions inside the operation.** An operation that needs a role takes the actor and returns `ForbiddenError` itself, so authorization never depends on the caller remembering. `test`
- **Build every field as a value object through a parse function** that trims, enforces limits and returns `ValidationError`. The domain owns the rules. Zod only checks shape (§4). `test`
- **Pass `now` and new ids into domain functions as arguments.** The domain stays deterministic, and there is no clock port. `review`
- **Give every aggregate a `version`.** Persistence owns it (§5). `review`
- **Order user-sorted items with fractional keys.** The item holds its parent's id and a base-62 key from the kernel's `keyBetween(a, b)`. Rows sort by `(position, id)`, with no unique index. A move writes one row, and an archived item keeps its key. `test`
- **Express rules that span aggregates as pure domain services** over aggregates loaded outside the transaction (read-checks). Races between them are accepted (§13). `review`

## 4. Application

Site: [Application](https://b-jones-rfd.github.io/next-ddd-starter/application/)

- **Put use cases only in `application/commands/*.command.ts` and `application/queries/*.query.ts`**, each a plain exported async function. The `api.ts` lint rules rely on these folders. `lint`
- **Write every command as load → domain function → `save(state, events)`.** One aggregate per transaction, and saving is publishing. Effects on other aggregates run later, as event handlers (§6). `review`
- **Take an explicit `actorId: UserId` in every command and query.** Identity's session use cases take the raw token instead, and sign-up, which creates the actor, takes neither (§9). `type`
- **Have queries skip the domain.** They read through read ports that return DTOs, and they filter by the actor's membership in the read itself. Nothing else authorizes a read. `test`
- **Keep queries read-only.** §13 names the one exception. `review`
- **Check input shape with a Zod 4 input schema in the use case, and nowhere else.** Zod is imported only in `application/`, it never ships to the client, and no rule exists in two places. `lint`
- **Return expected outcomes in a `Result`, and let outages propagate (§7).** Catch an `InfrastructureError` only to retry, compensate or fall back. `review`
- **Return plain DTOs, never aggregates**, typed in `application/dto/*.dto.ts`, with timestamps as ISO strings. `type`
- **Put ports that one context uses in its `application/ports/*.port.ts`**, as `interface I<Name>` declaring the errors it returns. `review`
- **Keep logging, tracing and OpenTelemetry out of `domain/` and `application/`** (§8). `lint`

## 5. Infrastructure and persistence

Site: [Infrastructure](https://b-jones-rfd.github.io/next-ddd-starter/infrastructure/)

- **Write each adapter as `class <Name> implements I<Name>`** in a flat `infrastructure/`, named for what it does, not its technology (`board-repository.ts`). Only adapters are classes. `review`
- **Repositories only load and `save(aggregate, events)`.** Nothing else writes an aggregate. `review`
- **Keep `save` synchronous inside its `async` signature:** `BEGIN IMMEDIATE`, the upsert with `WHERE version = ?`, child rows, outbox rows, then `COMMIT`, with no `await` in between. `node:sqlite` shares one connection, so an `await` inside a transaction lets another request's statements in. `review`
- **Reject stale writes.** A new aggregate has `version: 0` and is inserted at 1. An update that changes 0 rows rolls back and returns `ConflictError`, and nothing retries it automatically. Read outside the transaction. `test`
- **Write raw SQL with prepared statements.** No ORM, query builder or driver package. _This app's choice; decide per project_. The ports stay either way. `review`
- **Migrate forward only**, with numbered migrations tracked in `PRAGMA user_version`. `review`
- **Prefix every table with its context** (`boards_tasks`), with no cross-context joins or foreign keys. `review`
- **Never let a raw driver or SDK error escape an adapter.** Throw a `PersistenceError` or `ExternalServiceError` with the original as `cause` and `retryable` set (`SQLITE_BUSY` is retryable). Mocks throw the same classes. `test`
- **Configure the database with `DATABASE_PATH` only.** It is also the variable whose absence selects mock mode in dev. `review`

## 6. Between contexts

Site: [Contexts](https://b-jones-rfd.github.io/next-ddd-starter/contexts/)

- **Ask through a port the consumer owns.** The port speaks the consumer's language. Its adapter in the consumer's `infrastructure/` calls the supplier's `api.ts` queries and acts as an anti-corruption layer, translating results and errors, thrown ones included. `review`
- **Tell through versioned integration events**, `<context>.<Name>.v<n>` (`boards.TaskMoved.v1`), one file each in `application/contracts/` (`task-moved.v1.ts`) with a plain, serializable payload. Translate them from domain events, and never publish a domain event. `review`
- **Name events for intent, and carry `from` and `to` for any changed value** (`TaskRenamed`, not `TaskUpdated`). Consumers then get before and after values without copying aggregates. `review`
- **Never call another context's commands to cause a side effect**, and a downstream context never writes back upstream. `review`
- **Publish every state change another context needs.** Here, that is every boards and identity change, because audit records them all. `review`
- **Give each context one outbox** whose rows have a `scope` of `domain` or `integration`. `save` writes each domain event as a `domain` row and its translation as an `integration` row. `domain` rows reach only handlers in the same context. Each row is one envelope: `review`

  ```ts
  {
    ;(id /* UUID v7 */,
      type,
      version,
      occurredAt,
      aggregateId,
      aggregateVersion,
      actorId,
      causationId,
      payload)
  }
  ```

- **For a change a handler makes, keep `actorId` as the user who started the chain** and set `causationId` to the triggering event's id. It is null for a change a user made directly. There is no system user. `review`
- **Put event handlers in the consumer's `application/`**, importing the supplier's contracts. A handler loads outside any transaction, then writes its one aggregate, its own outbox rows and its inbox row (`<context>_inbox(event_id, handler)`) in one synchronous transaction. `review`
- **Make consumers idempotent.** The inbox drops a redelivered event. A projection ignores an event whose `aggregateVersion` is older than one it has already applied. `test`
- **Deliver through the in-process relay behind `IEventRelay`**, started once from `instrumentation.ts`. It is single-flight, polls and is kicked after each save, delivers each outbox in id order and marks a row delivered only when every handler has succeeded. `test`
- **Retry what is retryable, and fail everything else at once.** A row failing with a `retryable` `InfrastructureError` retries indefinitely, with backoff capped at 60 s, while its stream waits. Any other error marks the row `failed`, logs it and moves on. `npm run outbox:replay` resets `failed` rows. Delivered rows are kept. `test`
- **Expect projections to lag the command by one relay drain.** `app/` covers the gap with `useOptimistic` and never awaits the relay. `review`

## 7. Errors

Site: [Errors](https://b-jones-rfd.github.io/next-ddd-starter/errors/)

- **Make errors classes extending `AppError`** (`src/shared/kernel/errors/`, abstract, with a literal `code`), for `instanceof`, `cause` chains and stacks. `type`

  ```
  AppError
  ├─ DomainError: ValidationError { fields }, ForbiddenError, <rule errors>
  ├─ NotFoundError { entity, id }    ConflictError { entity, id }    UnauthenticatedError
  └─ InfrastructureError { port, retryable }: PersistenceError, ExternalServiceError
  ```

- **Return expected outcomes, and declare them in the signature. Throw only outages and bugs.** An outage is a translated `InfrastructureError`, which is never returned. `type`
- **Code rule errors `<context>.<aggregate>.<rule>`** (`boards.list.archived`) in `domain/<aggregate>/<aggregate>.errors.ts`. Shared errors use bare codes (`validation`, `forbidden`, `not-found`, `conflict`, `unauthenticated`). `review`
- **Write `message` for developers only:** constant text plus codes, ids and field names, never a value from input. It reaches logs and spans, and users never see it. `review`
- **Let error classes cross module boundaries through `api.ts`.** An ACL adapter translates another context's errors into its own port's errors, so one context's classes never reach another's domain. `review`
- **Convert errors to plain objects only in `src/app/_lib/errors/to-action-error.ts`.** It holds all user-facing wording, keyed by `code`, and turns anything thrown into `unexpected` with the trace id as its `reference`. There is no `UnexpectedError` class. Nothing in `app/` returns, passes or caches an error without going through it. `review`
- **Keep all user-facing text in `app/`.** `review`

## 8. Observability

Site: [Observability](https://b-jones-rfd.github.io/next-ddd-starter/observability/)

- **Say "diagnostic log" for technical and operational logging.** A bare "log" means the Audit log. `review`
- **Wrap every `api.ts` export in `traced`, one line per use case.** Lint bans every other export shape in `api.ts`. `lint`

  ```ts
  export const moveTask = traced('boards.moveTask', moveTaskCommand)
  ```

- **Name the span `<module>.<exportName>`**, using exactly the exported name. Lint checks the format, and review checks that it matches the export. `lint`
- **Let `traced` record outcomes and never convert them.** An expected error sets `app.error.kind` and `app.error.code` and leaves the status unset. A thrown error is recorded with its `cause` and sets `ERROR`, and the same object is rethrown. `traced` sets `app.module` and never logs. `test`
- **Record nothing from a use case's input, and never the actor**, on any span or metric. Personal data is hard to purge from a vendor backend, and the trace-id `reference` already finds a failing request. `review`
- **Write span data only in `src/shared/infrastructure/tracing/`**, through helpers that accept only the closed `Partial<AppAttributes>`. Keys are constants in `tracing/attributes.ts`. Lint bans `setAttribute(s)`, `addEvent`, `recordException` and `setStatus` everywhere else. `lint`
- **Treat `app.*` attribute keys, relay span names (`outbox.drain`, `outbox.deliver <type>`, `outbox.handle <module>.<handler>`) and metric names as a contract.** Renaming one needs a new ADR. Request span names follow their exports. `review`
- **Register outbox handlers as `<module>.<camelCaseName>`** (`audit.recordTaskMoved`). The relay asserts the format at registration. `test`
- **Store each outbox row's W3C trace context**, and **link** each delivery span to it rather than parenting it. `causationId` stays the domain's record of cause. `review`
- **Write diagnostic logs only from infrastructure, `src/di/`, the instrumentation shims and the `app/` edge**, through `@/shared/infrastructure/logging`. `pino` is banned outside the facade, and `no-console` is an error in `src/`. `lint`
- **Log only events from the closed `LogEvent` union**, as `logger.<level>(event, fields)`, where `fields` is exactly `LogEventFields[event]` (codes, ids, field names and `err`). Add a new event on purpose. `type`
- **Give each level one meaning.** `error`: a person needs to look. `warn`: degraded but self-healing, or an unusual setup. `info`: rare lifecycle events. `debug`: development detail. There is no `fatal`. `review`
- **Log a thrown error exactly once, where it leaves the server.** `onRequestError` logs `request.failed` for pages, layouts and route handlers. `to-action-error` logs `action.unexpected` under the trace id it returns. Expected errors are never logged. `review`
- **Make an `error` line stand on its own**, with the event, the error `code`, the ids needed to act and `err`. It never carries span timings or request shape, and `onRequestError` logs `routePath`, never `path`. `review`
- **Serialize errors only through the facade's `err` serializer** (`type`, `message`, `stack`, `code`, `retryable` and declared `AppError` data, along the `cause` chain). Never use pino's standard serializer or `redact`. `review`
- **Ship only the three outbox backlog gauges:** `app.outbox.pending`, `app.outbox.oldest_pending.age` and `app.outbox.failed`, read from `IOutbox.backlog()`, each with only `app.outbox.name`. Any metric added later goes through `getMeter()` in `src/shared/infrastructure/metrics/`, created after the SDK starts. `lint`
- **Configure observability only with the standard `OTEL_*` variables plus `LOG_LEVEL`** ([ADR 0015](https://github.com/B-Jones-RFD/next-ddd-starter/blob/main/docs/adr/0015-observability-is-configured-by-standard-otel-env-with-safe-defaults.md) holds the table, which `.env.example` mirrors). `readObservabilityConfig(env)` validates them and throws at startup on unknown values and on `OTEL_SDK_DISABLED=true`. Our code builds every processor and reader, and `NodeSDK` never chooses from env. `test`
- **Default every exporter to `none`, in every environment.** For traces, `none` is a `NoopSpanProcessor`, so trace ids always exist. In production with traces at `none`, `app.started` logs at `warn`. `test`
- **Never set sampling in code.** The standard sampler variables apply. `review`
- **Run CLI scripts with `--conditions=react-server`**, so the facade's `server-only` guard holds. `review`
- **Test telemetry once, never per feature.** The `unit` project registers an in-memory tracer, and `tests/fixtures/spans.ts` gives `recordedSpans()` and `withTestSpan(fn)`. Logs are silent under test and never asserted on. `traced` and the `reference` are tested once. Mock mode changes nothing here. `test`

## 9. Auth seam

Site: [Auth](https://b-jones-rfd.github.io/next-ddd-starter/auth/)

- **Choose authentication and sessions per project.** Here, sessions are rows in identity's database, with an opaque 256-bit cookie token and only its SHA-256 hash stored, plus scrypt passwords and 7-day idle and 30-day absolute expiry. _This app's choice; decide per project_. The rest of this section is the seam to keep. `review`
- **Reach authentication from `app/` only through identity's `api.ts`.** `authenticate(token)` returns `{ userId, displayName }`, and session ids never leave identity. Cookies are read only in `src/app/`, which passes the raw token in. `lint`
- **Pass an explicit `actorId: UserId` to every other context.** Swapping in an external provider then changes only identity, the cookie handling in `app/` and `proxy.ts`. `type`
- **Get the actor with `getActor()`** from `src/app/_lib/auth/`. It is server-only, memoized with React `cache()` and never `'use cache: private'`. Read it inside `<Suspense>`, in every page and action that needs it, never only in a layout. `review`
- **Authorize commands in the domain and queries in the read.** `app/` only hides UI. `test`
- **On a page, redirect an `UnauthenticatedError` to `/sign-in?next=<same-origin path>`, and turn a `ForbiddenError` into `notFound()`.** Leave `authInterrupts` off. `review`
- **Use `proxy.ts` only for an optimistic check** that the session cookie exists on protected routes. It never redirects away from `/sign-in`, where a stale cookie would loop. `review`

## 10. Presentation

Site: [Presentation](https://b-jones-rfd.github.io/next-ddd-starter/presentation/)

- **Read in Server Components through `api.ts` queries, and write in Server Actions through commands.** No route handlers, client-side fetching or data libraries. Add a route handler only for a caller other than the UI. `review`
- **Never `'use cache'` data that depends on the viewer.** One missed invalidation would show a removed Board member the board. A larger app may opt in per query, with an invalidation for every way access changes. `review`
- **Await request APIs (`cookies()`, `headers()`, `params`) and read them inside `<Suspense>`.** They are async-only in Next 16 and can't enter `'use cache'`. `review`
- **Keep a route's Server Actions in its one `actions.ts`**, shaped `(prev: ActionState, formData) =>`: call `getActor()`, build a plain input from `formData`, call `command({ actorId, ...input })`, then `refresh()` or `redirect()` on success. `review`
- **Validate only in the command's schema.** The action passes strings through unchecked, and the browser gets only HTML constraint attributes as hints. `review`
- **Return an `ActionState` from every action**, echoing `values` so inputs refill through `defaultValue` after React resets the form. `type`

  ```ts
  type ActionState =
    | { status: 'idle' }
    | { status: 'success' }
    | { status: 'error'; error: ActionError; values: Record<string, string> }
  ```

- **Wrap the command in `try/catch`, and return every failure through `toActionError`**, outages and bugs included, so a failed save shows in its form. A missing session redirects to sign-in. A forbidden or not-found result is shown in the form. `review`
- **On pages, call `notFound()` for `NotFoundError`, and let anything thrown reach `error.tsx` and `onRequestError`.** `review`
- **Show field errors under their inputs** (`Field`/`FieldError`, with `aria-invalid` and `aria-describedby`) and everything else in one `FormAlert`. There's no toast library. `review`
- **Submit with the shared `SubmitButton`** (`useFormStatus`). A dialog form closes on `success` through an `onSuccess` callback, and a full-page form redirects. `review`
- **Make mutating buttons `<form action={fn.bind(null, id)}>`, never `onClick`**, so they work before hydration. Bound ids are untrusted, and the domain checks them again. `review`
- **Default to Server Components, and put `'use client'` only on the smallest interactive part.** Client Components get serializable DTOs as props, import actions from their route's `actions.ts` and never import `@/modules`. `lint`
- **Use `useOptimistic` only where lag is built in** (posting a comment into Activity). `review`
- **Give each route segment a `loading.tsx` and each independent section its own `<Suspense>`.** Add `error.tsx` at the root and on key segments, plus `global-error.tsx` and `not-found.tsx`. `error.tsx` shows `error.digest` as the reference. `review`
- **Use DTOs as they are, with no view-model layer.** Format timestamps with the client `<Time>` component (DayJS) inside `<time dateTime>`. `review`
- **Put shared UI in `src/app/_components/`** (shadcn/ui in `ui/`) and shared edge code in `src/app/_lib/` (`actions/`, `errors/`, `auth/`). A route's own components sit beside its `page.tsx`, with descriptive names. `review`

### Accessibility and theming

- **Meet WCAG 2.2 AA in every theme:** 4.5:1 for text, and 3:1 for large text, UI parts and focus rings. Focus is never obscured, and targets are at least 24px. `test`
- **Never use color as the only signal.** Archived items get a text badge, tags always show their name, the Owner gets a crown plus "(Owner)" in the accessible name, and errors get text plus an icon. `review`
- **Style with semantic tokens only, never raw palette classes.** Add any new meaning (`--success`, tag tokens) to `globals.css` in every theme, extending shadcn's variables, so a theme is one place to change. `review`
- **Never read the theme on the server.** Here, the theme follows the system, with a System / Light / Dark choice in the account menu stored in `localStorage`. A hand-written inline `<head>` script sets `data-theme` before paint, `<html>` has `suppressHydrationWarning`, the `dark` variant is `[data-theme=dark]` or `prefers-color-scheme: dark` when unset, and a `matchMedia` listener keeps System live. _This app's choice; decide per project_. What carries over is no cookie, so the shell stays static ([ADR 0018](https://github.com/B-Jones-RFD/next-ddd-starter/blob/main/docs/adr/0018-the-theme-choice-is-stored-per-device-and-applied-by-an-inline-script.md)). `review`
- **Store a tag's color as a name, never hex or classes.** Here it is one of 8 (`gray red orange amber green teal blue violet`), a closed union in the domain. `app/` maps each to a `--tag-<name>` / `--tag-<name>-foreground` pair at 4.5:1 in every theme, and the picker shows each swatch with its name. _This app's choice; decide per project_. `type`
- **Keep the dialog primitive's focus:** in on open, back to the trigger on close, including a close through `onSuccess`. Override the first focus only on purpose. Here, the task dialog focuses its title heading and the type-the-name confirm focuses its input. `review`
- **When an action moves or removes the focused element, move focus to its logical successor.** After a ⋯-menu reorder, that's the moved item's ⋯ trigger in its new place, through one client hook keyed by id. After an archive that hides the item, it's the next item, or the column heading if there isn't one. `test`
- **Leave navigation focus to Next.** Full-page redirects use its route announcer and default focus, with no custom focus-to-`h1`. `review`
- **Show focus with shadcn's `focus-visible` ring**, with `--ring` tuned to 3:1 in each theme. `review`
- **Make tab order follow the DOM**, column by column (heading, ⋯, tasks, "Add task"), with no roving or positive `tabIndex`. A mobile jump-strip button scrolls to its column and focuses its heading (`tabIndex={-1}`). `review`
- **Add no custom keyboard shortcuts.** The primitives cover Tab, Enter/Space, arrows in menus and Escape. _This app's choice; decide per project_. `review`
- **Announce failures, not successes.** `FormAlert` is `role="alert"`, and field errors are reached through `aria-describedby`. A success gets no extra announcement, and there's no shared success live region. `review`
- **Don't make Activity a live region.** Here, posting a comment gives a visually hidden `role="status"` saying "Comment posted". _This app's choice; decide per project_. `review`
- **Name an icon-only button after its target** with `aria-label` ("Actions for list Backlog"). `review`
- **Make an avatar stack one element named by its members** ("Members: Ada (Owner), Ben"), with each avatar `aria-hidden`. `review`
- **Give each page `header`, `nav` where there is one, and `main`, with one `h1`.** On the board, each list column is a `section` named by its `h2`, and each task card's title is an `h3`. A dialog's title is its name. `review`
- **Honour `prefers-reduced-motion`** with one global CSS block plus `motion-safe:`. Under it, dialogs, sheets and menus are instant or fade, and programmatic scrolls use `behavior: 'auto'`. `review`
- **Lint with the full `jsx-a11y` recommended config.** `lint`
- **Sweep with axe once, never per feature.** One E2E test (`@axe-core/playwright`) visits every screen in light and dark and fails on any WCAG 2.2 AA violation. A `ui` test covers the refocus hook. `test`

## 11. Testing and definition of done

Site: [Testing](https://b-jones-rfd.github.io/next-ddd-starter/testing/)

- **Run `npm run check` before calling work done.** It runs typecheck, lint, the format check and `npm test`. `review`
- **Run `npm run test:e2e` as well when a change touches a critical flow, routing or actions in `src/app/`, `proxy.ts` or identity.** It needs a browser and a build, so it stays out of `check`. `review`
- **Use Vitest:** a `unit` project in `node` (domain, application, contract and the edge mapper), and a `ui` project in `jsdom` with React Testing Library. Playwright runs E2E. `review`
- **Test the domain directly:** pure functions, no DI and no mocks, with state built by builders. Assert on `{ state, events }` and on rule errors. `review`
- **Test application behaviour through `api.ts` on mock adapters.** Call `resetMockStores()` in `beforeEach`, and `await relay.drain()` before asserting on downstream effects. Arrange state through commands, never by writing to mock stores. Cross-context flows are tested here. `review`
- **Keep mocks honest with one contract suite per port.** `tests/contracts/<port>.contract.ts` exports `describe<Port>Contract(makeAdapter)`, and a runner calls it with the real adapter, on SQLite `:memory:` with the production migrations, and with the `.mock.ts` twin. `test`
- **Prove membership for every query.** Each context has one test that calls every exported query as a non-member and expects `ForbiddenError` or an empty result. It fails when a query has no case. `test`
- **Inject outages with `vi.spyOn(await getInjection('IPort'), 'method').mockRejectedValueOnce(...)`**, and produce conflicts from real stale versions. Mocks never get test-only hooks, because they ship in the bundle. `review`
- **Control time with `vi.setSystemTime()`.** `review`
- **Run E2E against `next build && next start` on a fresh SQLite file**, about five critical flows, each signing up its own users. Never depend on the seed. `review`
- **Mirror `src/` in `tests/`** with `*.test.ts(x)`. Builders and `given*` helpers go in `tests/fixtures/`, and E2E specs in `tests/e2e/*.spec.ts`. `review`
- **Telemetry needs nothing per feature** (§8). `review`
- **A feature is done when it ships:** `review`
  - domain tests for each operation and rule error
  - application tests for each `api.ts` export's happy path and declared errors
  - a membership case for each query
  - contract coverage for each port method
  - UI tests for Client Components with logic
  - a `to-action-error` case for each new error `code`
  - an E2E change only when a critical flow changes
  - this file amended if a rule changed, and the site page updated for each section the change first makes concrete
  - every site page that cites a changed ADR updated
- **Don't gate on coverage.** The checklist names what to test. `review`

## 12. Tooling and naming

Site: [Tooling](https://b-jones-rfd.github.io/next-ddd-starter/tooling/)

- **Run Node `>=26`** (`engines`, `.nvmrc`), for `node:sqlite`'s `Database`. `review`
- **Format with Prettier:** no semicolons, single quotes, 2 spaces, `es5` trailing commas and the Tailwind plugin. `lint`
- **Lint with `eslint-config-next`** (`core-web-vitals`, `typescript`), the type-aware `no-floating-promises`, `no-misused-promises`, `consistent-type-imports` and `switch-exhaustiveness-check` rules, `import/order` (builtin, external, `@/`, relative, separated by blank lines) and `eslint-config-prettier`. Boundary blocks are generated per context, with no custom rules. `lint`
- **Compile with `strict`** plus `noUncheckedIndexedAccess`, `noImplicitOverride` and `noFallthroughCasesInSwitch`, with no decorators. `type`
- **Name files and folders in kebab-case**, with a role suffix: `.port`, `.command`, `.query`, `.dto`, `.mock`, `.events`, `.errors`, `.service`, `.contract`, `.test`. Adapters, aggregates, value objects, components and `actions.ts` take none. `review`
- **Use camelCase for values and functions, PascalCase for types, components and classes**, and SCREAMING_CASE only for true module constants. `review`
- **Prefer `type` to `interface`, with no `I` or `T` prefix.** The exception is a port, which is `interface I<Name>`. `review`
- **Use string-literal unions, never `enum`.** `review`
- **Use named exports only**, and default exports only where Next requires one. `review`
- **Import through `@/` (which maps to `src/`), use `./` only for siblings, and never write `../`.** Built-ins take the `node:` prefix. `lint`
- **Don't add pre-commit hooks.** `npm run check` is the gate. `review`

## 13. Known exceptions and local-only simplifications

Site: [Exceptions](https://b-jones-rfd.github.io/next-ddd-starter/exceptions/)

These are deliberate. Don't "fix" them, and don't copy them anywhere else.

- **`getInjection` is a service locator.** `application/` importing `@/di/container` is a runtime edge pointing outward, while every type still points inward. It isn't a layering bug.
- **`authenticate` writes during render.** It updates `last_seen_at` at most once a minute, straight through the session repository, with no events. This is the one exception to read-only queries.
- **When a Board member leaves or is removed**, their assignments pass to the Owner, including on archived tasks. This is a handler-made change, exempt from the read-only rule.
- **Cross-aggregate read-checks can race.** For example, a task restored just as its list is archived. The resulting states are odd but valid.
- **All contexts share one SQLite file and connection.** Their tables stay separate by prefix.
- **Mocks ship in the production bundle.** They load only in mock mode.
- **Ports use the `I` prefix and `interface`**, and **Next's files use default exports**.
- **Error messages can carry input.** Third-party messages are kept as they are, and Next records thrown errors on its own spans.
- **Observability deviates from the OTel spec in two ways:** exporters default to `none`, and traces' `none` keeps the provider.
- **`ExternalServiceError` is unused here.** It is the pattern for apps that call external services.
- **The session cookie has no `__Host-` prefix**, because Safari rejects `Secure` cookies on `http://localhost`.
- **Local-only simplifications** that a deployed app replaces:
  - expired sessions are never purged (add a scheduled purge)
  - the sign-in throttle is in memory (add a shared store)
  - the outbox relay runs in-process (a worker can replace it behind `IEventRelay`)

## 14. Recipe: adding a feature

Site: [Using this as a template](https://b-jones-rfd.github.io/next-ddd-starter/template/)

1. **Name it.** Add or change the terms in the context's `GLOSSARY.md`.
2. **Domain.** Write the value objects, the operation returning `{ state, events }`, its rule errors and its domain events (§3). Add domain tests.
3. **Ports and adapters.** Add or extend the repository or read port, its adapter and `.mock.ts` twin, and the contract suite (§5, §11). Bind the adapter in `src/di/modules/<context>.module.ts` and `src/di/types.ts`.
4. **Use case.** Write the command or query with its Zod input schema and `actorId`, resolving ports with `await getInjection(...)` (§4).
5. **Events.** For a state change, add the `v1` contract in `application/contracts/`, its translation and the `contracts.ts` re-export. Add consumer handlers in their own `application/` (§6).
6. **Export.** Add it to `api.ts`, wrapped in `traced('<module>.<exportName>', …)` (§8).
7. **Application tests.** Cover the happy path and declared errors, plus a membership case for a query (§11).
8. **Edge.** Read it in a Server Component or write it in the route's `actions.ts`. Add wording and a test for each new error `code` in `to-action-error` (§7, §10).
9. **Verify.** Run `npm run check`, plus `npm run test:e2e` if a critical flow changed.
10. **Record.** Amend this file if a rule changed, and update the site page for each section the feature first makes concrete.
