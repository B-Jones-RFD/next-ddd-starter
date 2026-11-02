'use server'

import { redirect } from 'next/navigation'

import type { ActionState } from '@/app/_lib/actions/action-state'
import {
  clearSessionCookie,
  readSessionToken,
} from '@/app/_lib/auth/session-cookie'
import { toActionError } from '@/app/_lib/errors/to-action-error'
import { signOut } from '@/modules/identity/api'

/** Signs this browser out, from the account menu in the root layout. */
export async function signOutAction(): Promise<ActionState> {
  try {
    await signOut(await readSessionToken())
  } catch (error) {
    return { status: 'error', error: toActionError(error), values: {} }
  }
  await clearSessionCookie()
  // `redirect` throws, so it stays outside the try.
  redirect('/sign-in')
}
