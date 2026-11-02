'use client'

import { useActionState } from 'react'

import { Field } from '@/app/_components/form/field'
import { FormAlert } from '@/app/_components/form/form-alert'
import { SubmitButton } from '@/app/_components/form/submit-button'
import { IDLE } from '@/app/_lib/actions/action-state'
import { renameBoardAction } from '@/app/boards/[boardId]/settings/actions'

/** The Owner's rename form. The page keys it by the saved name. */
export function RenameBoardForm({
  boardId,
  name,
}: {
  boardId: string
  name: string
}) {
  const [state, action] = useActionState(
    renameBoardAction.bind(null, boardId),
    IDLE
  )
  const error = state.status === 'error' ? state.error : undefined
  const values = state.status === 'error' ? state.values : {}

  return (
    <form action={action} className='flex flex-col gap-4' noValidate>
      <FormAlert error={error && !error.fields ? error : undefined} />
      <Field
        name='name'
        label='Board name'
        autoComplete='off'
        required
        maxLength={60}
        defaultValue={values.name ?? name}
        error={error?.fields?.name}
      />
      <SubmitButton className='self-start'>Save board name</SubmitButton>
    </form>
  )
}
