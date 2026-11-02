'use server'

import { redirect } from 'next/navigation'

import { formValues, type ActionState } from '@/app/_lib/actions/action-state'
import { setSessionCookie } from '@/app/_lib/auth/session-cookie'
import { toActionError } from '@/app/_lib/errors/to-action-error'
import { signUp } from '@/modules/identity/api'

/** Signs the visitor up and in, then lands them on their boards. */
export async function signUpAction(
  _previous: ActionState,
  formData: FormData
): Promise<ActionState> {
  const input = formValues(formData, ['displayName', 'email', 'password'])
  // Everything but the password is echoed back to refill the form.
  const values = { displayName: input.displayName, email: input.email }

  let token: string
  try {
    const result = await signUp(input)
    if (!result.ok) {
      return { status: 'error', error: toActionError(result.error), values }
    }
    token = result.value.token
  } catch (error) {
    return { status: 'error', error: toActionError(error), values }
  }

  await setSessionCookie(token)
  // `redirect` throws, so it stays outside the try.
  redirect('/boards')
}
