'use server'

import { redirect } from 'next/navigation'

import { formValues, type ActionState } from '@/app/_lib/actions/action-state'
import { safeNextPath } from '@/app/_lib/auth/next-path'
import {
  readSessionToken,
  setSessionCookie,
} from '@/app/_lib/auth/session-cookie'
import { toActionError } from '@/app/_lib/errors/to-action-error'
import { signIn } from '@/modules/identity/api'

/**
 * Signs the visitor in, ending the older session this browser held, then
 * returns them to the same-origin `next` path, or their boards.
 */
export async function signInAction(
  _previous: ActionState,
  formData: FormData
): Promise<ActionState> {
  const input = formValues(formData, ['email', 'password', 'next'])
  // Everything but the password is echoed back to refill the form.
  const values = { email: input.email }

  let token: string
  try {
    const result = await signIn({
      email: input.email,
      password: input.password,
      currentToken: (await readSessionToken()) || undefined,
    })
    if (!result.ok) {
      return { status: 'error', error: toActionError(result.error), values }
    }
    token = result.value.token
  } catch (error) {
    return { status: 'error', error: toActionError(error), values }
  }

  await setSessionCookie(token)
  // `redirect` throws, so it stays outside the try.
  redirect(safeNextPath(input.next))
}
