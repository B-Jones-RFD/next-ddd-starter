'use client'

import { useActionState } from 'react'

import { Field } from '@/app/_components/form/field'
import { FormAlert } from '@/app/_components/form/form-alert'
import { SubmitButton } from '@/app/_components/form/submit-button'
import { IDLE } from '@/app/_lib/actions/action-state'
import { createTaskAction } from '@/app/boards/[boardId]/actions'

/** The form at the foot of a list that adds a task to its end. */
export function AddTaskForm({
  boardId,
  listId,
}: {
  boardId: string
  listId: string
}) {
  const [state, action] = useActionState(
    createTaskAction.bind(null, boardId, listId),
    IDLE
  )
  const error = state.status === 'error' ? state.error : undefined
  const values = state.status === 'error' ? state.values : {}

  return (
    <form action={action} className='flex flex-col gap-2' noValidate>
      <FormAlert error={error && !error.fields ? error : undefined} />
      <Field
        id={`add-task-${listId}-title`}
        name='title'
        label='Task title'
        autoComplete='off'
        required
        maxLength={200}
        defaultValue={values.title}
        error={error?.fields?.title}
      />
      <SubmitButton className='self-start' variant='outline'>
        Add task
      </SubmitButton>
    </form>
  )
}
