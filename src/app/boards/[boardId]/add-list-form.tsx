'use client'

import { useActionState } from 'react'

import { Field } from '@/app/_components/form/field'
import { FormAlert } from '@/app/_components/form/form-alert'
import { SubmitButton } from '@/app/_components/form/submit-button'
import { IDLE } from '@/app/_lib/actions/action-state'
import { createListAction } from '@/app/boards/[boardId]/actions'

/** The form after the last column that adds a list to the end of the board. */
export function AddListForm({ boardId }: { boardId: string }) {
  const [state, action] = useActionState(
    createListAction.bind(null, boardId),
    IDLE
  )
  const error = state.status === 'error' ? state.error : undefined
  const values = state.status === 'error' ? state.values : {}

  return (
    <form action={action} className='flex flex-col gap-3' noValidate>
      <FormAlert error={error && !error.fields ? error : undefined} />
      <Field
        id='add-list-name'
        name='name'
        label='List name'
        autoComplete='off'
        required
        maxLength={60}
        defaultValue={values.name}
        error={error?.fields?.name}
      />
      <SubmitButton className='self-start'>Add list</SubmitButton>
    </form>
  )
}
