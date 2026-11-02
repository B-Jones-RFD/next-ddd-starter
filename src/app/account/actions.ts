'use server'

import { refresh } from 'next/cache'
import { redirect } from 'next/navigation'

import { formValues, type ActionState } from '@/app/_lib/actions/action-state'
import { getActor } from '@/app/_lib/auth/get-actor'
import { signInPath } from '@/app/_lib/auth/next-path'
import {
  clearSessionCookie,
  readSessionToken,
} from '@/app/_lib/auth/session-cookie'
import { toActionError } from '@/app/_lib/errors/to-action-error'
import {
  changePassword,
  rename,
  signOutEverywhere,
} from '@/modules/identity/api'

const SIGN_IN = signInPath('/account')

// #region rename-action
/** Changes the signed-in user's display name, then re-renders the page. */
export async function renameAction(
  _previous: ActionState,
  formData: FormData
): Promise<ActionState> {
  const actor = await getActor()
  if (!actor.ok) redirect(SIGN_IN)
  const values = formValues(formData, ['displayName'])

  try {
    const result = await rename({ actorId: actor.value.userId, ...values })
    if (!result.ok) {
      return { status: 'error', error: toActionError(result.error), values }
    }
  } catch (error) {
    return { status: 'error', error: toActionError(error), values }
  }
  refresh()
  return { status: 'success' }
}
// #endregion rename-action

/**
 * Changes the signed-in user's password. Their other sessions end, and this
 * one stays signed in.
 */
export async function changePasswordAction(
  _previous: ActionState,
  formData: FormData
): Promise<ActionState> {
  const actor = await getActor()
  if (!actor.ok) redirect(SIGN_IN)
  const input = formValues(formData, ['currentPassword', 'newPassword'])

  let signedOut = false
  try {
    const result = await changePassword({
      actorId: actor.value.userId,
      token: await readSessionToken(),
      ...input,
    })
    if (!result.ok) {
      if (result.error.code === 'unauthenticated') signedOut = true
      else {
        // Passwords are never echoed back.
        return {
          status: 'error',
          error: toActionError(result.error),
          values: {},
        }
      }
    }
  } catch (error) {
    return { status: 'error', error: toActionError(error), values: {} }
  }
  // `redirect` throws, so it stays outside the try.
  if (signedOut) redirect(SIGN_IN)
  return { status: 'success' }
}

/** Ends every session of the signed-in user, this one included. */
export async function signOutEverywhereAction(): Promise<ActionState> {
  try {
    // Without a valid session there is nothing left to end here.
    await signOutEverywhere(await readSessionToken())
  } catch (error) {
    return { status: 'error', error: toActionError(error), values: {} }
  }
  await clearSessionCookie()
  redirect('/sign-in')
}
