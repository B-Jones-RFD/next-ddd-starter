# What changed in Next.js 16

Research for [#3](https://github.com/B-Jones-RFD/next-ddd-starter/issues/3), part of the map [#1](https://github.com/B-Jones-RFD/next-ddd-starter/issues/1).

**Question:** What do the docs bundled in `node_modules/next/dist/docs/` say has changed in Next.js 16 that affects how this app is built?

**Source:** Only the docs bundled with the installed `next@16.4.3`. Paths below are relative to `node_modules/next/dist/docs/`. Where these docs disagree with general knowledge of Next.js 13–15, the docs win. Where two bundled pages disagree, both are noted.

**Repo baseline that matters:** `next.config.ts` already sets `cacheComponents: true` and `partialPrefetching: true` (plus `experimental.agentFeedback`). So everything below is read **with Cache Components on**. That is the docs' recommended default for new apps (`01-app/01-getting-started/08-caching.md`, "Enabling Cache Components").

---

## TL;DR: the facts that most constrain later decisions

1. **Cache Components is on, so nothing is cached unless you opt in with `'use cache'`.** Data fetching is dynamic by default. Each route prerenders a static shell, and runtime or uncached parts stream in behind `<Suspense>` (Partial Prerendering is the default model). Source: `01-app/03-api-reference/05-config/01-next-config-js/cacheComponents.md`.
2. **Reading `cookies()`, `headers()`, `searchParams`, or dynamic `params`, or doing uncached async I/O, outside a `<Suspense>` boundary is flagged (blocking-route insight or build error).** This shapes every page and layout: put session reads inside a Suspense boundary, not at the top of a layout. Sources: `01-app/01-getting-started/08-caching.md` ("Working with runtime APIs"), `01-app/03-api-reference/04-functions/cookies.md`, `01-app/02-guides/authentication-with-cache-components.md` (Step 2).
3. **`'use cache'` scopes cannot read `cookies()`/`headers()`/`searchParams`.** Read them outside and pass values (such as `userId`) in as arguments, or use `'use cache: private'`. Source: `01-app/03-api-reference/01-directives/use-cache.md` ("Request-time APIs").
4. **Request APIs are async-only.** Synchronous access to `cookies`, `headers`, `draftMode`, `params`, and `searchParams` is removed in 16. Source: `01-app/02-guides/upgrading/version-16.md` ("Async Request APIs").
5. **Mutations use Server Actions plus `updateTag`.** Calling `updateTag` from a Server Action gives read-your-own-writes, and the re-rendered page comes back in the same response. `revalidateTag` now needs a second `cacheLife` argument and is stale-while-revalidate. Sources: `01-app/03-api-reference/04-functions/updateTag.md`, `revalidateTag.md`, `01-app/02-guides/server-actions.md`.
6. **Every Server Action is a public POST endpoint.** The docs say to authenticate and authorize inside each one, validate input, and return minimal data. Sources: `01-app/02-guides/server-actions.md` ("Security"), `01-app/02-guides/data-security.md`.
7. **`middleware` is deprecated and renamed `proxy`.** It is Node.js-only and its runtime can't be configured. The docs describe it as a "last resort", fit only for **optimistic** cookie-only auth checks. It is not session management. Sources: `01-app/03-api-reference/03-file-conventions/proxy.md`, `01-app/01-getting-started/16-proxy.md`.
8. **The docs' auth model is a server-only Data Access Layer (DAL) that verifies the session, authorizes, and returns DTOs.** Checks belong near the data, not in layouts. The docs describe database sessions explicitly. Sources: `01-app/02-guides/authentication.md`, `01-app/02-guides/data-security.md`.
9. **Expected errors are return values (`useActionState`), not throws. Unexpected errors go to `error.tsx` or `catchError`.** `error.tsx` now gets `retry()` (stable in 16.3). Source: `01-app/01-getting-started/10-error-handling.md`, `01-app/03-api-reference/03-file-conventions/error.md`.
10. **`forbidden()`/`unauthorized()` (403/401 UI) are still experimental** and need `experimental.authInterrupts: true`. Source: `01-app/03-api-reference/05-config/01-next-config-js/authInterrupts.md`.

---

## 1. Caching and Cache Components

### Model

- With `cacheComponents: true`, "Data fetching is dynamic by default, and you choose what to cache at the page, component, or function level. Next.js prerenders a static HTML shell that is served immediately while dynamic content streams in." — `01-app/03-api-reference/05-config/01-next-config-js/cacheComponents.md`
- `cacheComponents` replaces the removed flags `experimental.ppr`, `experimental.dynamicIO`, `experimental.useCache` and the `experimental_ppr` segment export. — same file; `01-app/02-guides/upgrading/version-16.md` ("Partial Prerendering", "Removals")
- Set `partialPrefetching` explicitly or a warning is logged. "Both features will be enabled everywhere in the next major release, and the options will be removed." — `cacheComponents.md`
- Cache Components **requires the Node.js runtime**. Remove any `runtime` export, including `runtime = 'nodejs'`. — `cacheComponents.md`; `01-app/02-guides/migrating-to-cache-components.md` ("`runtime = 'edge'`")
- When a route is prerendered, its parts are handled by kind (`01-app/01-getting-started/08-caching.md`, "Prerendering"):
  - `use cache` results go into the static shell, unless their lifetime is too short.
  - `<Suspense>` fallbacks go into the shell while the content streams.
  - Module imports, sync fs, and pure computation are prerendered automatically.
  - `Math.random()`, `Date.now()`, `crypto.randomUUID()` must be handled explicitly with `connection()`/`io()` plus `<Suspense>`, or with `use cache`.
- **Synchronous DB drivers** (`better-sqlite3`, `node:sqlite`) complete during prerender like predictable values. Call `connection()` (or `io()`) first if you need per-request data. — `08-caching.md` ("Predictable values"); `01-app/03-api-reference/04-functions/connection.md`
- With Cache Components, `<Activity>` keeps up to 3 previously visited routes mounted but hidden. Their state (form drafts, open dialogs) survives back/forward. React state also survives a user change, so key forms by user id or do a full reload on logout. — `cacheComponents.md` ("Navigation with Activity"); `01-app/02-guides/preserving-ui-state.md` ("Forms, inputs, and state", "State and authentication")

### `'use cache'`

Source: `01-app/03-api-reference/01-directives/use-cache.md`

- It can be placed at file level (every export cached, all must be async), function level, or component level. Cached functions must be async.
- **The cache key** is built from four parts: the build ID (or `deploymentId`), a function ID, the serialized arguments **plus captured closure variables**, and (in dev only) an HMR hash. Entries do **not** survive a new deploy.
- **Arguments must be serializable:** primitives, plain objects, arrays, Date/Map/Set/TypedArray. Class instances, functions (except pass-through), symbols, and URL instances are **not supported**. *(This affects passing domain entities/value objects into cached functions: pass plain data.)*
- **It can't read `cookies()`, `headers()` or `searchParams`.** The restriction follows the call stack (error `next-request-in-use-cache`), and "it can pass `next build` and fail under `next start`."
- `React.cache` is isolated inside `use cache` scopes, so you can't pass data in through it.
- **Default storage is an in-memory LRU.** On a self-hosted server, entries persist across requests (size set by `cacheMaxMemorySize`). On serverless they generally don't. `'use cache: remote'` uses a durable cache handler.
- The client router enforces a **minimum 30 s stale time**.
- The docs recommend pairing every `use cache` with an explicit `cacheLife`. Without one, the `default` profile applies (stale 5 min, revalidate 15 min, expire never). Nesting a short-lived cache inside one with no explicit `cacheLife` fails the build.
- Prerender hangs (a 50 s timeout) mean a request-specific Promise leaked into a cached scope.
- `use cache` cannot go directly inside a Route Handler body. Extract a helper. — `01-app/01-getting-started/15-route-handlers.md`
- **Stable since v16.0.0.**

### `'use cache: private'`

Source: `01-app/03-api-reference/01-directives/use-cache-private.md`

- It **can** read `cookies()`, `headers()` and `searchParams`. It **cannot** call `connection()`.
- In production, results are deduped within one request and kept in **browser memory only** for the `stale` time. They are never stored in a server cache across requests. You can't use a custom cache handler.
- The result is excluded from the static shell. `stale` must be at least 30 s for per-link prefetch and at least 5 min to join the App Shell.
- For request-scoped dedup only, use `cacheLife({ stale: Infinity })`.
- The docs' auth-with-Cache-Components guide uses it for `getCurrentUser()`. Session helpers read the cookie deep inside and compare expiry against the current time, so the value can't be lifted out into an argument. — `01-app/02-guides/authentication-with-cache-components.md` (Step 1)

### `cacheLife`

Source: `01-app/03-api-reference/04-functions/cacheLife.md`

- Stable in v16 (`unstable_cacheLife` deprecated). Import with `import { cacheLife, cacheTag } from 'next/cache'`.
- Preset profiles:

| Profile | stale | revalidate | expire |
| --- | --- | --- | --- |
| `default` | 5 min | 15 min | never |
| `seconds` | 30 s | 1 s | 1 min |
| `minutes` | 5 min | 1 min | 1 h |
| `hours` | 5 min | 1 h | 1 day |
| `days` | 5 min | 1 day | 1 week |
| `weeks` | 5 min | 1 week | 30 days |
| `max` | 5 min | 30 days | 1 year |

- Prerendering thresholds: `revalidate: 0` or `expire` < 5 min leaves a dynamic hole (excluded from prerender). `stale` < 30 s is excluded from prerender. `stale` from 30 s up to 5 min is prerendered but kept out of the App Shell. Of the presets, only `seconds` hits a threshold.
- Custom profiles are defined in `next.config` (`01-app/03-api-reference/05-config/01-next-config-js/cacheLife.md`). Inline objects are also accepted.

### `cacheTag`

Source: `01-app/03-api-reference/04-functions/cacheTag.md`

- Call it inside a `use cache` scope with one or more strings. Limits: 128 tags per call, 256 chars per tag. Stable in v16 (`unstable_cacheTag` deprecated).
- **Cache keys and tags are stored in plain text.** "Key and tag on a stable identifier like the user id, and keep secrets and sensitive personal data … out" of them. — `01-app/02-guides/authentication-with-cache-components.md` (Step 4)

### `connection()` and `io()`

- `connection()` (`next/server`) makes rendering wait for a real request. It replaces the deprecated `unstable_noStore`. It is not allowed inside `use cache` or `use cache: private`. — `01-app/03-api-reference/04-functions/connection.md`, `unstable_noStore.md`
- **New in v16.3: `io()`.** "With Cache Components, prefer `io()` for excluding content from the static shell." Unlike `connection()`, it doesn't block prefetches, and the code after it can still be cached and prefetched. It resolves immediately at request time, inside cache scopes, in the browser, and in apps without Cache Components. — `01-app/03-api-reference/04-functions/io.md`

### Route segment config under Cache Components

- **`dynamic`, `revalidate`, `fetchCache` and `dynamicParams` are removed when Cache Components is on.** Exporting them errors. Remaining options: `runtime` (but see above: Cache Components forbids it), `preferredRegion` (deprecated), `maxDuration`, plus the Cache-Components-only `ensureStatic` and `instant`. — `01-app/03-api-reference/03-file-conventions/02-route-segment-config/index.md`; `01-app/02-guides/migrating-to-cache-components.md`
- `generateStaticParams` must return **at least one** param under Cache Components. An empty array errors. To reject unknown params, call `notFound()` (since `dynamicParams: false` is gone). — `migrating-to-cache-components.md` ("generateStaticParams and dynamicParams")
- `export const instant = false | true | {…}` (stable in v16.3) controls *instant navigation validation*. It is dev-only, at `warning` level by default. `false` on a segment marks it "allowed to block" and also opts it out of the static-shell check. It does **not** clear sync-IO (`new Date()` etc.) prerender errors. — `01-app/03-api-reference/03-file-conventions/02-route-segment-config/instant.md`; `migrating-to-cache-components.md` ("Opting out of validation")
- `ensureStatic` enforces that chosen output (App Shell, prefetch, or whole route) stays static. — `.../route-segment-config/ensureStatic.md`
- `unstable_cache` still works. `React.cache` still dedupes within a render (but isolated per Cache Function). — `migrating-to-cache-components.md`

### Prefetching (with `partialPrefetching: true`)

- By default the router prefetches each route's **App Shell**, which includes static content **and session data derived from `cookies()`/`headers()`**. Content that depends on URL data (`params`, `searchParams`) is only prefetched with `<Link prefetch={true}>`, at the cost of one server invocation per link. — `01-app/01-getting-started/08-caching.md` ("Prefetching")
- An App Shell that reads `cookies()`/`headers()` is cached per session on the client, not in the shared server cache. — `08-caching.md` ("Where cached content is stored")

---

## 2. Server Actions, forms, and revalidation

### Server Actions

Sources: `01-app/01-getting-started/07-mutating-data.md`, `01-app/02-guides/server-actions.md`

- A Server Function is defined with `'use server'`, either at the top of an async function (inline in a Server Component) or at the top of a file. They **can't be defined in Client Components**, only imported from a `'use server'` file or passed as props.
- Only `POST` invokes them. Used as `<form action>` or `<button formAction>`, they run in a transition. Forms in Server Components work without JS (progressive enhancement).
- **The client dispatches actions one at a time per client**, so don't use `Promise.all` to parallelize actions. The server itself doesn't queue them.
- **The response is a single roundtrip.** If the action calls `updateTag`, `revalidatePath`, `refresh`, sets or deletes a cookie, or calls `redirect`, the response carries both the return value and a freshly rendered RSC payload for the current route. `revalidateTag` with a SWR profile does **not** trigger that re-render.
- **`redirect()` throws.** Code after it doesn't run, so call revalidation first.
- **Framework protections:**
  - CSRF check: `Origin` vs `Host`/`X-Forwarded-Host`, configurable with `serverActions.allowedOrigins`. A request with no `Origin` header is allowed with a warning.
  - 1 MB body limit (`serverActions.bodySizeLimit`).
  - Encrypted action IDs, rotated at most every 14 days.
  - Dead-code elimination of unused actions.
  - Encrypted closure variables. Set `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` for multi-instance deployments.
  - Sources: `server-actions.md` ("Security"), `01-app/03-api-reference/05-config/01-next-config-js/serverActions.md`, `01-app/02-guides/data-security.md`.
- **App-level duties the docs require:** authenticate and authorize inside every action ("Render-time gating … is not a security boundary"), validate inputs (they name Zod or Valibot), constrain return values, and send IDs rather than row contents, re-reading ownership from the session (IDOR). — `server-actions.md`; `data-security.md` ("Authentication and authorization")
- The docs recommend applying the DAL to mutations: "keeps authentication, authorization, and database logic in a dedicated `server-only` module, while `"use server"` actions stay thin." — `data-security.md` ("Using a Data Access Layer for mutations")
- **Deployments** generate new action IDs, so clients on an old build hit "Failed to find Server Action". The docs suggest surfacing this as a retry path in the UI. — `server-actions.md` ("Deployment considerations")

### Choosing a cache update after a mutation

Sources: `01-app/02-guides/server-actions.md` ("Choosing a cache update"), the function references in `01-app/03-api-reference/04-functions/`

| API | Where | Semantics |
| --- | --- | --- |
| `updateTag(tag)` | **Server Actions only** | Expires immediately. The next read (including the action's own re-render) waits for fresh data. Read-your-own-writes. |
| `revalidateTag(tag, profile)` | Server Functions and Route Handlers (not Proxy or Client) | Stale-while-revalidate. **The second arg is required** (`'max'` recommended, or `{ expire: 0 }` for immediate expiry outside actions). The single-arg form is deprecated and a TS error. |
| `revalidatePath(path, type?)` | Server Functions and Route Handlers | Invalidates by route path. In Server Functions it currently also refreshes all previously visited pages on revisit (noted as temporary). |
| `refresh()` | **Server Actions only** | Refetches the current route's RSC payload. Doesn't invalidate tagged data. New in 16. |

- `refresh` and `updateTag` are imported from `next/cache`. — `01-app/02-guides/upgrading/version-16.md` ("Caching APIs")
- None of these throw, so an action can call them and still return a value. — `server-actions.md`

### Forms

Source: `01-app/02-guides/forms.md`

- A `<form action={serverAction}>` receives `FormData`. `Object.fromEntries(formData)` includes extra `$ACTION_*` keys.
- Extra arguments go through `.bind(null, id)`, which works in Server and Client Components and supports progressive enhancement. The other option is hidden inputs, which are not encoded.
- **Validation errors use `useActionState`.** The form component becomes a Client Component, and the action signature becomes `(prevState, formData)`. `useActionState` also exposes `pending`. `useFormStatus` is the alternative for a nested submit button. `useOptimistic` handles optimistic UI.
- **Expected errors should be returned, not thrown**: "avoid using `try`/`catch` blocks and throw errors. Instead, model expected errors as return values." — `01-app/01-getting-started/10-error-handling.md`
- `next/form` `<Form>`: with a **string** `action` it does a GET navigation with search params, prefetching, and client-side nav (good for search/filter). With a **function** `action` it behaves like a React form, and `replace`/`scroll` are ignored. — `01-app/03-api-reference/02-components/form.md`

---

## 3. Route Handlers

Sources: `01-app/01-getting-started/15-route-handlers.md`, `01-app/03-api-reference/03-file-conventions/route.md`

- A `route.ts` handles GET, POST, PUT, PATCH, DELETE, HEAD and OPTIONS. Other methods return 405. A `route.ts` can't sit in the same segment as a `page.tsx`.
- **With Cache Components, `GET` handlers follow the page model.** They run at request time by default, and are prerendered only if they touch no uncached or runtime data. Reading `request.url`, `request.headers`, `request.cookies`, `request.body`, `cookies()`, `headers()` or `connection()` stops prerendering. Non-GET methods are never cached.
- `context.params` is a Promise. The `RouteContext<'/path/[id]'>` type helper is generated by `next dev`, `next build` or `next typegen`.
- In route handlers, `updateTag` and `refresh` are not available. Use `revalidateTag(tag, profile)` / `revalidatePath`. — `updateTag.md`, `refresh.md`
- The docs say to treat Route Handlers like public API endpoints and verify the session and role in each. — `01-app/02-guides/authentication.md` ("Route Handlers")

---

## 4. `proxy` (formerly `middleware`)

Sources: `01-app/03-api-reference/03-file-conventions/proxy.md`, `01-app/01-getting-started/16-proxy.md`, `01-app/03-api-reference/03-file-conventions/middleware.md`, `01-app/02-guides/upgrading/version-16.md`

- **`middleware.ts` and its `middleware` export are deprecated.** Rename to `proxy.ts` with a default or named `proxy` export (codemod available). Config flags were renamed too (`skipMiddlewareUrlNormalize` → `skipProxyUrlNormalize`).
- **Runtime:** Node.js only. Setting `runtime` in a proxy file throws. The Edge runtime isn't supported in `proxy`. If you need edge, you'd keep `middleware`, and the Edge runtime is itself deprecated (`.../route-segment-config/runtime.md`).
- One `proxy.ts` per project, at the root (or `src/`), alongside `app/`.
- **Without a `matcher`, it runs on every request, including `_next/static`, `_next/image` and `public/`.** Use a negative-lookahead matcher. Matcher values must be static constants.
- **Server Functions are POSTs to the page route**, so a matcher that excludes a path also skips its actions. "Always verify authentication and authorization inside each Server Function rather than relying on Proxy alone."
- **Intended use:** header changes, rewrites, redirects, and "optimistic checks". "It should not be used as a full session management or authorization solution." Fetch cache options have no effect in proxy. The docs recommend avoiding it "unless no other options exist."
- For auth, the docs' own pattern ("Optimistic checks with Proxy") decrypts the session cookie only, with no DB calls, because proxy runs on every route including prefetches. — `01-app/02-guides/authentication.md`
- `revalidateTag`/`revalidatePath` can't be called in Proxy. `after()` and `event.waitUntil()` can. — `revalidateTag.md`, `after.md`, `proxy.md`

---

## 5. `cookies()` and `headers()`

Sources: `01-app/03-api-reference/04-functions/cookies.md`, `headers.md`, `01-app/02-guides/upgrading/version-16.md`

- Both are **async** (`(await cookies()).get('session')`). In v16 the synchronous compatibility path is **removed**.
  - *Doc inconsistency:* the `cookies.md`, `headers.md`, `page.md`, `layout.md` and `draft-mode.md` reference pages still say "you can still access it synchronously in Next.js 15, but this behavior will be deprecated". The v16 upgrade guide is the newer, authoritative statement: "synchronous access is fully removed."
- **`cookies().set()`/`.delete()` work only in Server Functions or Route Handlers**, never during Server Component render ("HTTP does not allow setting cookies after streaming starts"). Setting or deleting a cookie in a Server Action re-renders the current page and layouts in the same response.
- Cookie options: `name`, `value`, `expires`, `maxAge`, `domain`, `path` (default `/`), `secure`, `httpOnly`, `sameSite`, `priority`, `partitioned`. For session cookies the auth guide recommends `httpOnly`, `secure`, `sameSite: 'lax'`, `expires`, and `path: '/'`. — `cookies.md`; `01-app/02-guides/authentication.md` ("Setting cookies")
- `headers()` is read-only.
- **With Cache Components, calling either outside `<Suspense>` prevents prerendering** (error `blocking-prerender-runtime`). Neither is allowed inside `use cache`. Both are allowed inside `use cache: private`.
- `params` and `searchParams` are Promises. `PageProps<'/route'>` and `LayoutProps<'/route'>` are global type helpers generated by `next typegen`/dev/build. — `version-16.md` ("Migrating types for async Request-time APIs")
- The docs' pattern is to pass the `params` promise into a Suspense-wrapped child rather than awaiting it at the top of a layout, which keeps the shell static. — `08-caching.md` ("Maximizing the static shell")

---

## 6. Loading, error, and not-found conventions

### `loading.tsx`

Source: `01-app/03-api-reference/03-file-conventions/loading.md`

- `loading.tsx` wraps `page` (and `not-found` and nested layouts) of its segment in `<Suspense>`. It does **not** wrap that segment's `layout` or `error`.
- **With Cache Components, uncached or runtime data in a layout must be explicitly wrapped in `<Suspense>` (`loading.tsx` doesn't cover it), otherwise you get a build-time error.**
- **The status code is fixed once streaming starts.** `notFound()`, `forbidden()` and `unauthorized()` called before the first Suspense fallback flushes return 404, 403 or 401. Called after, the status stays `200` and Next.js adds `noindex`.

### `error.tsx` / `global-error.tsx` / `catchError`

Sources: `01-app/03-api-reference/03-file-conventions/error.md`, `01-app/03-api-reference/04-functions/catchError.md`, `01-app/01-getting-started/10-error-handling.md`

- `error.tsx` must be a Client Component. Its props are `error`, **`retry`** (re-fetches and re-renders; stable in v16.3, was `unstable_retry` in 16.2), and `reset` (re-renders without re-fetching; the docs say use `retry` in most cases).
- Server Component errors arrive in production with a generic message plus `error.digest` for log correlation.
- `error.tsx` doesn't catch errors in the same segment's `layout`. Use `global-error.tsx` for the root, which must render its own `<html>`/`<body>` and doesn't get global styles.
- **New: `catchError(fallback)`** (stable in v16.3) builds component-level error boundaries. Import it with `import { catchError, type ErrorInfo } from 'next/error'`. They pass `redirect()` and `notFound()` through correctly and clear on navigation. The fallback must be a Client Component.
- Error boundaries don't catch event-handler or async errors. Errors thrown inside `startTransition` do bubble up to them.

### `not-found.tsx`, `forbidden.tsx`, `unauthorized.tsx`

Sources: `01-app/03-api-reference/03-file-conventions/not-found.md`, `01-app/03-api-reference/04-functions/not-found.md`, `forbidden.md`, `unauthorized.md`, `01-app/03-api-reference/05-config/01-next-config-js/authInterrupts.md`

- `notFound()` throws and is typed `never`. A `try/catch` around it swallows it, so use `unstable_rethrow`. It also works in Server Functions and Route Handlers (returns a 404 there).
- The docs' idiom is to call `notFound()`/`forbidden()`/`unauthorized()` **inside the DAL function** awaited by a Suspense-wrapped component.
- Root `app/not-found.tsx` also handles unmatched URLs. `global-not-found.js` is experimental (`globalNotFound` flag) and only needed with multiple root layouts.
- **`forbidden()` (403) and `unauthorized()` (401) are experimental.** They need `experimental.authInterrupts: true` and can't be called in the root layout.
- Parallel route slots now **require** `default.js`, or the build fails. — `01-app/02-guides/upgrading/version-16.md`

---

## 7. Auth guidance in the docs

Sources: `01-app/02-guides/authentication.md`, `01-app/02-guides/authentication-with-cache-components.md`, `01-app/02-guides/data-security.md`

- **Three parts:** authentication, session management, and authorization.
- **Sign-up and login** use `<form>`, a Server Action, `useActionState`, server-side schema validation, and then session creation followed by `redirect`.
- **Database sessions are described explicitly:**
  1. A sessions table.
  2. Insert, update and delete functions.
  3. "Encrypt the session ID before storing it in the user's browser" (optional, but recommended so Proxy can do optimistic checks).
  - Stated benefits: last-login tracking, active devices, and "log out of all devices".
- The docs "recommend using an authentication library" and name `iron-session`/`jose` for session management. Hand-rolled auth is presented "for educational purposes". *(The map rules out third-party auth providers, not crypto helpers. Whether to use `jose`/`iron-session` or `node:crypto` is a decision for the Auth ticket.)*
- **The DAL:**
  - A `server-only` module with a `verifySession()` wrapped in `React.cache`. It reads the cookie and decrypts or validates it, then redirects or returns `{ userId }`.
  - Data functions call it and return **DTOs** (minimal fields).
  - "`React.cache` deduplicates within a React render pass. Server Actions and Route Handlers are not part of a render pass, so the wrapper does nothing" there.
- **The docs recommend one data-fetching approach per app.** For new projects that's a DAL that "only run[s] on the server", performs authorization checks, and returns DTOs. — `data-security.md` ("Data fetching approaches")
- **Layouts aren't a security boundary.** They don't re-render on navigation, and they don't stop child segments or slots from rendering or appearing in the RSC payload. `return null` in a layout for unauthorized users is "not recommended". Check near the data (DAL) or in leaf components. — `authentication.md` ("Layouts and auth checks")
- **With Cache Components** (`authentication-with-cache-components.md`):
  - Session reads happen at request time and sit behind `<Suspense>`. A top-level `await` on the session in a layout holds back `{children}`.
  - `getCurrentUser()` uses `'use cache: private'` (browser-only caching).
  - Per-user data: an exported getter resolves the user, then calls an **unexported** `'use cache'` function keyed by `userId` with a `cacheTag`. Keeping it unexported means callers can't request another user's data.
  - After a mutation, call `updateTag` with the same tag, and re-read the session inside the action.
  - Client Components get the user through a promise passed via context and unwrapped with `use()`.
  - `export const instant = false` lets un-migrated session-reading routes keep blocking.
- **Audit checklist the docs suggest:**
  - DB packages and env vars are imported only inside the DAL.
  - `"use server"` files validate args, re-authorize, check ownership, filter returns, and delegate to a `server-only` DAL.
  - `[param]` folders are treated as user input.
  - `proxy.ts` and `route.ts` get extra scrutiny.
  - Source: `data-security.md` ("Auditing").
- **No mutations during render.** "Next.js explicitly prevents setting cookies or triggering cache revalidation within render methods." Logout and similar actions must be Server Actions. — `data-security.md` ("Avoiding side-effects during rendering")
- `import 'server-only'` causes a build error when the module is imported on the client. It is handled internally by Next.js, so no install is needed unless lint complains. — `data-security.md`
- `after(cb)` runs work after the response. It's usable in Server Functions, Route Handlers and Proxy, runs even on error or redirect, and in actions or handlers can read `cookies()`/`headers()` inside the callback. The docs pitch it for logging and analytics. *(Relevant when deciding whether audit entries are written transactionally or after the response.)* — `01-app/03-api-reference/04-functions/after.md`

---

## 8. Deprecations, removals, and other breaking changes in 16

Source unless noted: `01-app/02-guides/upgrading/version-16.md`

**Removed**
- Sync access to request APIs (see §5).
- `next lint`: use ESLint/Biome directly, and `next build` no longer lints. The `eslint` key in next.config is also gone.
- AMP.
- `serverRuntimeConfig`/`publicRuntimeConfig`: use env vars, with `connection()` before reading `process.env` for runtime values.
- `experimental.dynamicIO`/`experimental.useCache`/`experimental.ppr`/`experimental_ppr` (now `cacheComponents`).
- `unstable_rootParams` (use `next/root-params`).
- `devIndicators` options `appIsrStatus`, `buildActivity`, `buildActivityPosition`.
- `size`/`First Load JS` build output.
- Under Cache Components only: segment configs `dynamic`, `revalidate`, `fetchCache`, `dynamicParams` (`.../route-segment-config/index.md`).

**Deprecated**
- `middleware` → `proxy`.
- Single-arg `revalidateTag(tag)`.
- `unstable_cacheLife`/`unstable_cacheTag` (now stable names).
- `unstable_noStore` (→ `connection`).
- Edge runtime / `runtime = 'edge'` (`.../route-segment-config/runtime.md`).
- `preferredRegion`.
- `next/legacy/image`.
- `images.domains` (→ `remotePatterns`).

**Breaking defaults and behavior**
- Turbopack is the default for `dev` and `build`. A custom `webpack` config fails the build unless `--webpack` is passed. `turbopack` config is now top-level.
- Node ≥ 20.9, TypeScript ≥ 5.1.
- `next dev` outputs to `.next/dev`, and a lockfile blocks concurrent `dev`/`build` instances.
- The props of image-generation functions (`opengraph-image`, `icon`) and the sitemap `id` are now Promises.
- Parallel route slots require `default.js`.
- `next/image` defaults changed:
  - `minimumCacheTTL` is 4 h.
  - `16` was dropped from `imageSizes`.
  - `qualities` is `[75]`.
  - Local IPs are blocked.
  - `maximumRedirects` is 3.
  - Local images with query strings need `localPatterns.search`.
- Next.js no longer overrides `scroll-behavior: smooth`. Opt back in with `data-scroll-behavior="smooth"` on `<html>`.
- `@next/eslint-plugin-next` defaults to flat config.
- `process.argv.includes('dev')` in next.config is now `false` under `next dev`.

**Newly stable and new**
- `cacheComponents`, `use cache`, `cacheLife`, `cacheTag` (16.0).
- `updateTag` and `refresh` (16.0).
- React Compiler support (`reactCompiler: true`, opt-in; needs `babel-plugin-react-compiler`).
- `adapterPath` (stable in 16.2).
- `catchError` and `error.tsx` `retry` (16.3).
- `io()` (16.3).
- `instant` segment config (16.3).
- **React:** the App Router uses React canary with 19.2 features (View Transitions, `useEffectEvent`, `<Activity>`). This repo pins React 19.3.0.

---

## Gaps: not found or unclear in the bundled docs

- **No guidance on transactions or DB-level atomicity** for Server Actions (relevant to writing audit entries alongside mutations). The docs only offer `after()` for post-response side effects.
- **Password hashing:** the auth guide's sign-up sample calls `bcrypt.hash(password, 10)` only as an example (`01-app/02-guides/authentication.md`, "Create a user or check user credentials"). The docs don't recommend an algorithm or library, and they don't mention `node:crypto` `scrypt`.
- **Sync-API status is inconsistent between pages.** The reference pages for `cookies`, `headers`, `page`, `layout` and `draftMode` still use Next 15 wording. The v16 upgrade guide says sync access is removed. Treat it as removed.
- **`forbidden`/`unauthorized` remain experimental** (`version: experimental` / `canary` in front-matter) even at 16.4.3. No stabilization date is given.
- The docs don't say whether `'use cache'` entries survive a `next start` restart on a self-hosted server. The in-memory LRU implies they don't, and durable storage requires `cacheHandlers` / `'use cache: remote'`.
