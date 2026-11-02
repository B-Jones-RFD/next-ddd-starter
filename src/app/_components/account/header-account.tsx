import Link from 'next/link'

import { AccountMenu } from '@/app/_components/account/account-menu'
import { getActor } from '@/app/_lib/auth/get-actor'

/**
 * The header's account corner: the account menu when signed in, a sign-in
 * link otherwise. It reads the session, so the layout renders it inside its
 * own `<Suspense>` (§9). It never redirects, so it is safe on `/sign-in`.
 */
export async function HeaderAccount() {
  const actor = await getActor()
  if (actor.ok) {
    // Keyed by user, so no menu state survives a change of user.
    return (
      <AccountMenu
        key={actor.value.userId}
        displayName={actor.value.displayName}
      />
    )
  }
  return (
    <Link
      href='/sign-in'
      className='rounded-sm text-sm font-medium text-foreground underline underline-offset-4'
    >
      Sign in
    </Link>
  )
}
