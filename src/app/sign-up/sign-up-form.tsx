'use client'

import { useActionState } from 'react'

import { Field } from '@/app/_components/form/field'
import { FormAlert } from '@/app/_components/form/form-alert'
import { SubmitButton } from '@/app/_components/form/submit-button'
import { IDLE } from '@/app/_lib/actions/action-state'
import { signUpAction } from '@/app/sign-up/actions'

export function SignUpForm() {
  const [state, action] = useActionState(signUpAction, IDLE)
  const error = state.status === 'error' ? state.error : undefined
  const values = state.status === 'error' ? state.values : {}
  // Field errors show under their inputs; anything else goes in the alert.
  const alert = error && !error.fields ? error : undefined

  return (
    <form action={action} className='flex flex-col gap-4' noValidate>
      <FormAlert error={alert} />
      <Field
        name='displayName'
        label='Display name'
        autoComplete='nickname'
        required
        maxLength={50}
        defaultValue={values.displayName}
        error={error?.fields?.displayName}
      />
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
        autoComplete='new-password'
        required
        minLength={8}
        error={error?.fields?.password}
      />
      <SubmitButton className='w-full'>Create account</SubmitButton>
    </form>
  )
}
