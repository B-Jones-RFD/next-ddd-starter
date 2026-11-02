'use client'

import { Archive } from 'lucide-react'
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
import {
  archiveBoardAction,
  restoreBoardAction,
} from '@/app/boards/[boardId]/settings/actions'

const CONFIRM_ID = 'archive-board-confirm-name'

/**
 * The Owner's "Archive board" button and its type-the-name confirm dialog,
 * which focuses its input on open (§10). On success the action redirects to
 * the boards grid, which the board has left.
 */
export function ArchiveBoardDialog({
  boardId,
  name,
}: {
  boardId: string
  name: string
}) {
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant='destructive' />}>
        <Archive aria-hidden />
        Archive board
      </DialogTrigger>
      <DialogContent initialFocus={() => document.getElementById(CONFIRM_ID)}>
        <DialogTitle>Archive “{name}”?</DialogTitle>
        <DialogDescription>
          It leaves every member’s board grid and becomes read-only. Its lists
          and tasks stay as they are, and you can restore it from the Archived
          view.
        </DialogDescription>
        {/* The popup unmounts on close, so each opening starts fresh. */}
        <ArchiveBoardForm boardId={boardId} name={name} />
      </DialogContent>
    </Dialog>
  )
}

function ArchiveBoardForm({
  boardId,
  name,
}: {
  boardId: string
  name: string
}) {
  const [state, action] = useActionState(
    (previous: ActionState, formData: FormData) =>
      archiveBoardAction(boardId, previous, formData),
    IDLE
  )
  const error = state.status === 'error' ? state.error : undefined
  const values = state.status === 'error' ? state.values : {}

  return (
    <form action={action} className='flex flex-col gap-4' noValidate>
      <FormAlert error={error && !error.fields ? error : undefined} />
      <Field
        id={CONFIRM_ID}
        name='confirmName'
        label={`Type “${name}” to confirm`}
        autoComplete='off'
        required
        defaultValue={values.confirmName}
        error={error?.fields?.confirmName}
      />
      <SubmitButton variant='destructive' className='self-end'>
        Archive board
      </SubmitButton>
    </form>
  )
}

/** The id of the Archive heading, where focus goes when its button goes. */
export const ARCHIVE_HEADING_ID = 'board-archive-heading'

/**
 * The Owner's "Restore board" button, for an archived board. On success it
 * gives way to "Archive board", so focus moves to the section's heading.
 */
export function RestoreBoardForm({ boardId }: { boardId: string }) {
  const [state, action] = useActionState(async () => {
    const next = await restoreBoardAction(boardId)
    if (next.status === 'success') {
      document.getElementById(ARCHIVE_HEADING_ID)?.focus()
    }
    return next
  }, IDLE)

  return (
    <form action={action} className='flex flex-col items-start gap-2'>
      <FormAlert error={state.status === 'error' ? state.error : undefined} />
      <SubmitButton variant='outline'>Restore board</SubmitButton>
    </form>
  )
}
