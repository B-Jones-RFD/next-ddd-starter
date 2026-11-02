'use client'

import { Pencil } from 'lucide-react'
import { useActionState, useState } from 'react'

import { Field } from '@/app/_components/form/field'
import { FormAlert } from '@/app/_components/form/form-alert'
import { SubmitButton } from '@/app/_components/form/submit-button'
import { TagColorPicker } from '@/app/_components/tags/tag-color-picker'
import {
  asTagColor,
  type TagColorName,
} from '@/app/_components/tags/tag-colors'
import { Button } from '@/app/_components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from '@/app/_components/ui/dialog'
import { IDLE, type ActionState } from '@/app/_lib/actions/action-state'
import {
  createTagAction,
  deleteTagAction,
  editTagAction,
} from '@/app/boards/[boardId]/settings/tags/actions'
import { TAGS_HEADING_ID } from '@/app/boards/[boardId]/settings/tags/tags-heading'

type Tag = { id: string; name: string; color: TagColorName }

/** Defines a new tag. React resets the form after a success. */
export function CreateTagForm({ boardId }: { boardId: string }) {
  const [state, action] = useActionState(
    createTagAction.bind(null, boardId),
    IDLE
  )
  const error = state.status === 'error' ? state.error : undefined
  const values = state.status === 'error' ? state.values : {}

  return (
    <form action={action} className='flex flex-col gap-4' noValidate>
      <FormAlert error={error && !error.fields ? error : undefined} />
      <Field
        id='new-tag-name'
        name='name'
        label='Tag name'
        autoComplete='off'
        required
        maxLength={60}
        defaultValue={values.name}
        error={error?.fields?.name}
      />
      <TagColorPicker
        // A new key refills the radios from what was submitted.
        key={values.color}
        id='new-tag-color'
        defaultValue={asTagColor(values.color, 'gray')}
        error={error?.fields?.color}
      />
      <SubmitButton className='self-start'>Add tag</SubmitButton>
    </form>
  )
}

/** A tag's "Edit" button and its dialog, to rename and recolor it. */
export function EditTagDialog({ boardId, tag }: { boardId: string; tag: Tag }) {
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant='outline' size='lg' />}>
        <Pencil aria-hidden />
        Edit<span className='sr-only'> tag {tag.name}</span>
      </DialogTrigger>
      <DialogContent>
        <DialogTitle>Edit tag “{tag.name}”</DialogTitle>
        {/* The popup unmounts on close, so each opening starts fresh. */}
        <EditTagForm
          boardId={boardId}
          tag={tag}
          onSuccess={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  )
}

function EditTagForm({
  boardId,
  tag,
  onSuccess,
}: {
  boardId: string
  tag: Tag
  onSuccess: () => void
}) {
  const [state, action] = useActionState(
    async (previous: ActionState, formData: FormData) => {
      const next = await editTagAction(boardId, tag.id, previous, formData)
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
        id={`tag-${tag.id}-name`}
        name='name'
        label='Tag name'
        autoComplete='off'
        required
        maxLength={60}
        defaultValue={values.name ?? tag.name}
        error={error?.fields?.name}
      />
      <TagColorPicker
        key={values.color}
        id={`tag-${tag.id}-color`}
        defaultValue={asTagColor(values.color, tag.color)}
        error={error?.fields?.color}
      />
      <SubmitButton className='self-end'>Save tag</SubmitButton>
    </form>
  )
}

/**
 * Deletes a tag. Its row goes on success, so focus moves to the Tags heading
 * instead of being lost (§10).
 */
export function DeleteTagForm({ boardId, tag }: { boardId: string; tag: Tag }) {
  const [state, action] = useActionState(async () => {
    const next = await deleteTagAction(boardId, tag.id)
    if (next.status === 'success') {
      document.getElementById(TAGS_HEADING_ID)?.focus()
    }
    return next
  }, IDLE)

  return (
    <form action={action} className='flex flex-col items-end gap-2'>
      <FormAlert error={state.status === 'error' ? state.error : undefined} />
      <SubmitButton variant='destructive'>
        Delete<span className='sr-only'> tag {tag.name}</span>
      </SubmitButton>
    </form>
  )
}
