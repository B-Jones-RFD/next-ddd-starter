'use client'

import { useActionState } from 'react'

import { Field } from '@/app/_components/form/field'
import { FormAlert } from '@/app/_components/form/form-alert'
import { SubmitButton } from '@/app/_components/form/submit-button'
import { IDLE } from '@/app/_lib/actions/action-state'
import {
  changePasswordAction,
  renameAction,
  signOutEverywhereAction,
} from '@/app/account/actions'

/** Changes the display name. The page keys it by the saved name. */
export function DisplayNameForm({ displayName }: { displayName: string }) {
  const [state, action] = useActionState(renameAction, IDLE)
  const error = state.status === 'error' ? state.error : undefined
  const values = state.status === 'error' ? state.values : {}

  return (
    <form action={action} className='flex flex-col gap-4' noValidate>
      <FormAlert error={error && !error.fields ? error : undefined} />
      <Field
        name='displayName'
        label='Display name'
        autoComplete='nickname'
        required
        maxLength={50}
        defaultValue={values.displayName ?? displayName}
        error={error?.fields?.displayName}
      />
      <SubmitButton className='self-start'>Save display name</SubmitButton>
    </form>
  )
}

export function PasswordForm() {
  const [state, action] = useActionState(changePasswordAction, IDLE)
  const error = state.status === 'error' ? state.error : undefined

  return (
    <form action={action} className='flex flex-col gap-4' noValidate>
      <FormAlert error={error && !error.fields ? error : undefined} />
      <Field
        name='currentPassword'
        label='Current password'
        type='password'
        autoComplete='current-password'
        required
        error={error?.fields?.currentPassword}
      />
      <Field
        name='newPassword'
        label='New password'
        type='password'
        autoComplete='new-password'
        required
        minLength={8}
        error={error?.fields?.newPassword}
      />
      <SubmitButton className='self-start'>Change password</SubmitButton>
      {/* Successes get no announcement (§10); this is only shown. */}
      {state.status === 'success' && (
        <p className='text-sm text-muted-foreground'>
          Password changed. Your other sessions have ended.
        </p>
      )}
    </form>
  )
}

export function SignOutEverywhereForm() {
  const [state, action] = useActionState(signOutEverywhereAction, IDLE)

  return (
    <form action={action} className='flex flex-col gap-4'>
      <FormAlert error={state.status === 'error' ? state.error : undefined} />
      <SubmitButton className='self-start'>Sign out everywhere</SubmitButton>
    </form>
  )
}
