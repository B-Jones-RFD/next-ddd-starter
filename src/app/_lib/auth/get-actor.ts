import 'server-only'

import { io } from 'next/cache'
import { redirect } from 'next/navigation'
import { cache } from 'react'

import { signInPath } from '@/app/_lib/auth/next-path'
import { readSessionToken } from '@/app/_lib/auth/session-cookie'
import { authenticate, type ActorDto } from '@/modules/identity/api'

/**
 * Who is signed in (§9): the session cookie's user, or
 * `UnauthenticatedError`. Memoized per render with React `cache()`, never
 * `'use cache: private'`. Read it inside `<Suspense>`, in every page and
 * action that needs it.
 */
export const getActor = cache(async () => {
  const token = await readSessionToken()
  // `authenticate` reads the clock and SQLite synchronously. With partial
  // prefetching, a cookie read alone doesn't keep that out of a runtime
  // prefetch, so `io()` marks the IO that follows (a no-op in a request).
  await io()
  return authenticate(token)
})

/**
 * The actor, for a page or action at `path`. Without a valid session it
 * redirects to sign-in, which returns to `path` afterwards (§9).
 */
export async function requireActor(path: string): Promise<ActorDto> {
  const actor = await getActor()
  if (!actor.ok) redirect(signInPath(path))
  return actor.value
}
