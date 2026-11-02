'use client'

import { useActionState } from 'react'

import { Field } from '@/app/_components/form/field'
import { FormAlert } from '@/app/_components/form/form-alert'
import { SubmitButton } from '@/app/_components/form/submit-button'
import { IDLE } from '@/app/_lib/actions/action-state'
import { signInAction } from '@/app/sign-in/actions'

/** `next` is where to return afterwards; the action checks it again. */
export function SignInForm({ next }: { next: string }) {
  const [state, action] = useActionState(signInAction, IDLE)
  const error = state.status === 'error' ? state.error : undefined
  const values = state.status === 'error' ? state.values : {}
  // Field errors show under their inputs; anything else goes in the alert.
  const alert = error && !error.fields ? error : undefined

  return (
    <form action={action} className='flex flex-col gap-4' noValidate>
      <FormAlert error={alert} />
      <input type='hidden' name='next' value={next} />
      <Field
        name='email'
        label='Email'
        type='email'
        autoComplete='email'
        required
        defaultValue={values.email}
        error={error?.fields?.email}
      />
      <Field
        name='password'
        label='Password'
        type='password'
        autoComplete='current-password'
        required
        error={error?.fields?.password}
      />
      <SubmitButton className='w-full'>Sign in</SubmitButton>
    </form>
  )
}
