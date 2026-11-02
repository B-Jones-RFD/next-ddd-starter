'use client'

import { useActionState } from 'react'

import { Field, TextareaField } from '@/app/_components/form/field'
import { FormAlert } from '@/app/_components/form/form-alert'
import { SubmitButton } from '@/app/_components/form/submit-button'
import { IDLE } from '@/app/_lib/actions/action-state'
import {
  changeTaskDescriptionAction,
  renameTaskAction,
} from '@/app/boards/[boardId]/tasks/[taskId]/actions'

type Props = {
  boardId: string
  task: { id: string; title: string; description: string }
}

/** Edits the task's title. A field error keeps what was typed. */
export function TaskTitleForm({ boardId, task }: Props) {
  const [state, action] = useActionState(
    renameTaskAction.bind(null, boardId, task.id),
    IDLE
  )
  const error = state.status === 'error' ? state.error : undefined
  const values = state.status === 'error' ? state.values : {}

  return (
    <form action={action} className='flex flex-col gap-2' noValidate>
      <FormAlert error={error && !error.fields ? error : undefined} />
      <Field
        id={`task-${task.id}-title`}
        name='title'
        label='Title'
        autoComplete='off'
        required
        maxLength={200}
        defaultValue={values.title ?? task.title}
        error={error?.fields?.title}
      />
      <SubmitButton className='self-end' variant='outline'>
        Save title
      </SubmitButton>
    </form>
  )
}

/** Edits or clears the task's description. */
export function TaskDescriptionForm({ boardId, task }: Props) {
  const [state, action] = useActionState(
    changeTaskDescriptionAction.bind(null, boardId, task.id),
    IDLE
  )
  const error = state.status === 'error' ? state.error : undefined
  const values = state.status === 'error' ? state.values : {}

  return (
    <form action={action} className='flex flex-col gap-2' noValidate>
      <FormAlert error={error && !error.fields ? error : undefined} />
      <TextareaField
        id={`task-${task.id}-description`}
        name='description'
        label='Description'
        rows={6}
        maxLength={5000}
        defaultValue={values.description ?? task.description}
        error={error?.fields?.description}
      />
      <SubmitButton className='self-end' variant='outline'>
        Save description
      </SubmitButton>
    </form>
  )
}
