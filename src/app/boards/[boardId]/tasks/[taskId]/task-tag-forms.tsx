'use client'

import { X } from 'lucide-react'
import { useActionState } from 'react'

import { FormAlert } from '@/app/_components/form/form-alert'
import { SubmitButton } from '@/app/_components/form/submit-button'
import { TagBadge } from '@/app/_components/tags/tag-badge'
import type { TagColorName } from '@/app/_components/tags/tag-colors'
import { Label } from '@/app/_components/ui/label'
import { Select } from '@/app/_components/ui/select'
import { IDLE, type ActionState } from '@/app/_lib/actions/action-state'
import { tagsHeadingId } from '@/app/boards/[boardId]/task-places'
import {
  tagTaskAction,
  untagTaskAction,
} from '@/app/boards/[boardId]/tasks/[taskId]/actions'

type Tag = { id: string; name: string; color: TagColorName }

/**
 * One of the task's tags, with a button to detach it. The button goes with
 * the chip on success, so focus moves to the Tags heading (§10).
 */
export function TaskTagChip({
  boardId,
  taskId,
  tag,
}: {
  boardId: string
  taskId: string
  tag: Tag
}) {
  const [state, action] = useActionState(async (): Promise<ActionState> => {
    const next = await untagTaskAction(boardId, taskId, tag.id)
    if (next.status === 'success') {
      document.getElementById(tagsHeadingId(taskId))?.focus()
    }
    return next
  }, IDLE)

  return (
    <li className='flex flex-col items-start gap-1'>
      <form action={action}>
        <TagBadge tag={tag} className='py-0 pr-0 text-sm'>
          <button
            type='submit'
            aria-label={`Remove tag ${tag.name}`}
            className='inline-flex size-6 items-center justify-center rounded-md outline-none hover:bg-foreground/10 focus-visible:ring-3 focus-visible:ring-ring'
          >
            <X aria-hidden className='size-3.5' />
          </button>
        </TagBadge>
      </form>
      <FormAlert error={state.status === 'error' ? state.error : undefined} />
    </li>
  )
}

/** Attaches one of the board's other tags to the task. */
export function TagTaskForm({
  boardId,
  taskId,
  available,
}: {
  boardId: string
  taskId: string
  /** The board's tags the task doesn't have yet. */
  available: Tag[]
}) {
  const [state, action] = useActionState(
    tagTaskAction.bind(null, boardId, taskId),
    IDLE
  )
  const id = `task-${taskId}-add-tag`

  return (
    <form action={action} className='flex flex-col gap-2'>
      <FormAlert error={state.status === 'error' ? state.error : undefined} />
      <div className='flex flex-wrap items-end gap-2'>
        <div className='flex min-w-40 flex-col gap-1.5'>
          <Label htmlFor={id}>Add a tag</Label>
          <Select id={id} name='tagId' required>
            {available.map((tag) => (
              <option key={tag.id} value={tag.id}>
                {tag.name}
              </option>
            ))}
          </Select>
        </div>
        <SubmitButton variant='outline'>Add tag</SubmitButton>
      </div>
    </form>
  )
}
