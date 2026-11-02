// In-memory state for the `.mock.ts` adapters (§2). It lives on `globalThis`,
// so every bundle in the process (instrumentation and app routes) shares one
// copy, and `resetMockStores()` empties all of it between tests.

const globals = globalThis as { __mockStores?: Map<string, unknown> }

function stores(): Map<string, unknown> {
  globals.__mockStores ??= new Map()
  return globals.__mockStores
}

/** The store named `name`, created by `create` on first use or after a reset. */
export function mockStore<T>(name: string, create: () => T): T {
  const all = stores()
  if (!all.has(name)) all.set(name, create())
  return all.get(name) as T
}

/** Empties every mock store. Call it in `beforeEach`. */
export function resetMockStores(): void {
  stores().clear()
}
