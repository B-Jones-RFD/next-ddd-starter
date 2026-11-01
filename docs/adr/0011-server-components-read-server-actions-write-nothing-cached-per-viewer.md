# Server Components read, Server Actions write, and nothing per-viewer is cached

`app/` reaches the application layer in exactly two ways. Server Components call `getActor()` and then a module's `api.ts` query, and pass the DTOs down as props. Server Actions, in each route's single `actions.ts`, call `api.ts` commands. There are no route handlers, no client-side fetching and no data-fetching library. Data that depends on the viewer is never put in `'use cache'`. Every board read is filtered by membership, so a cache would have to be keyed by `actorId` and cleared by tag on every write and every membership change. One missed `updateTag` would leave a removed Board member still seeing the board. Against local SQLite, that risk buys almost no speed. Validation runs once, in the command's Zod input schema: the action passes the submitted strings through unchecked, and the browser gets only HTML constraint attributes (`required`, `maxLength`) as hints. Zod never ships to the client, and no rule exists in two places.

## Decisions

- **Action shape**: `(prev: ActionState, formData) =>` `getActor()`, then a plain input object built from `formData`, then `command({ actorId, ...input })`. On success the action calls `refresh()` or `redirect()`. On failure it returns `toActionError(...)` ([ADR 0008](./0008-error-classes-thrown-outages-and-an-edge-mapper-in-app.md)). With nothing cached, `refresh()` is what puts the re-rendered route into the action's response.
- **`ActionState`**: `{ status: 'idle' } | { status: 'success' } | { status: 'error', error: ActionError, values }`. `values` echoes the submitted input, because React 19 resets uncontrolled forms after an action. Inputs read it through `defaultValue`.
- **Inside an action**, a missing session calls `redirect('/sign-in?next=<same-origin path>')`. `ForbiddenError` and `NotFoundError` are returned as `ActionError`s and shown in the form's alert, so the form isn't thrown away. Pages still call `notFound()` ([ADR 0009](./0009-database-sessions-with-opaque-tokens-not-jwts.md)).
- **Buttons that mutate** (archive, restore, move, leave) are `<form action={fn.bind(null, id)}>`, never `onClick`, so they work before hydration. Bound ids are untrusted input that the domain re-checks.
- **Client Components** get serializable DTOs as props and import actions from their route's `actions.ts`. They never import `@/modules`, and lint enforces it.
- **`useOptimistic`** is used only where the lag is built in: posting a comment into Activity ([ADR 0010](./0010-one-audit-entry-per-integration-event-and-activity-as-a-filtered-view.md)).

## Considered Options

- **`'use cache'` keyed by `actorId`, with board tags cleared by `updateTag`.** Faster repeat reads, but authorization correctness would depend on invalidation being complete. A larger app with a remote database may opt in, but only for specific queries, and only with an invalidation event for every way access can change.
- **Route handlers with client-side fetching.** A second API surface to secure and keep in sync, with no consumer that needs it. Add one only when something other than the UI needs to call in.
- **Validating in the action or the browser as well (shared Zod schemas).** Errors would appear sooner, but rules would be duplicated or the domain's input schemas would end up in the client bundle.
