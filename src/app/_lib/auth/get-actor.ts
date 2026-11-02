import 'server-only'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { cache } from 'react'

import { SESSION_COOKIE } from '@/app/_lib/auth/session-cookie'
import { authenticate, type ActorDto } from '@/modules/identity/api'

/**
 * Who is signed in (§9): the session cookie's user, or
 * `UnauthenticatedError`. Memoized per render with React `cache()`, never
 * `'use cache: private'`. Read it inside `<Suspense>`, in every page and
 * action that needs it.
 */
export const getActor = cache(async () => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value ?? ''
  return authenticate(token)
})

/**
 * The actor, for a page. Without a session it redirects to sign-up, the only
 * way in until sign-in exists (slice 3 points this at `/sign-in?next=`).
 */
export async function requireActor(): Promise<ActorDto> {
  const actor = await getActor()
  if (!actor.ok) redirect('/sign-up')
  return actor.value
}
