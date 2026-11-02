'use client'

import { Plus } from 'lucide-react'
import { useActionState, useState } from 'react'

import { Field } from '@/app/_components/form/field'
import { FormAlert } from '@/app/_components/form/form-alert'
import { SubmitButton } from '@/app/_components/form/submit-button'
import { Button } from '@/app/_components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from '@/app/_components/ui/dialog'
import { IDLE, type ActionState } from '@/app/_lib/actions/action-state'
import { createBoardAction } from '@/app/boards/actions'

/** The "Create board" button and its dialog form. */
export function CreateBoardDialog() {
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size='lg' />}>
        <Plus aria-hidden />
        Create board
      </DialogTrigger>
      <DialogContent>
        <DialogTitle>Create board</DialogTitle>
        <DialogDescription>
          You’ll be its Owner, and only you can see it until you add members.
        </DialogDescription>
        {/* The popup unmounts on close, so each opening starts fresh. */}
        <CreateBoardForm onSuccess={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  )
}

function CreateBoardForm({ onSuccess }: { onSuccess: () => void }) {
  const [state, action] = useActionState(
    async (previous: ActionState, formData: FormData) => {
      const next = await createBoardAction(previous, formData)
      if (next.status === 'success') onSuccess()
      return next
    },
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
        defaultValue={values.name}
        error={error?.fields?.name}
      />
      <SubmitButton className='self-end'>Create board</SubmitButton>
    </form>
  )
}
