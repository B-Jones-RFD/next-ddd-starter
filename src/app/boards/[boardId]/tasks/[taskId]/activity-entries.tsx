'use client'

import {
  useActionState,
  useOptimistic,
  useRef,
  useState,
  type ReactNode,
} from 'react'

import { TextareaField } from '@/app/_components/form/field'
import { FormAlert } from '@/app/_components/form/form-alert'
import { SubmitButton } from '@/app/_components/form/submit-button'
import { IDLE, type ActionState } from '@/app/_lib/actions/action-state'
import { addCommentAction } from '@/app/boards/[boardId]/tasks/[taskId]/actions'

/** A comment shown before Activity has its entry. */
type PendingComment = { id: string; text: string }

// #region optimistic-comment
/**
 * The comment form above the task's Activity entries (`children`, rendered
 * on the server). A posted comment shows at the top at once, through
 * `useOptimistic` while the post runs, then from state until the refreshed
 * Activity has its entry, matched by the comment's id (§6, §10). A failure
 * takes it out again and puts its text back in the box.
 */
export function ActivityEntries({
  boardId,
  taskId,
  authorName,
  hasEntries,
  commentIds,
  children,
}: {
  boardId: string
  taskId: string
  /** The viewer's display name, shown on a comment they just posted. */
  authorName: string
  hasEntries: boolean
  /** The ids of the comments the entries already show. */
  commentIds: readonly string[]
  children?: ReactNode
}) {
  const formRef = useRef<HTMLFormElement>(null)
  const [posted, setPosted] = useState<PendingComment[]>([])
  const [posting, addPosting] = useOptimistic(
    posted,
    (current, comment: PendingComment) => [comment, ...current]
  )
  const [state, action] = useActionState(
    async (previous: ActionState, formData: FormData) => {
      const raw = formData.get('text')
      const text = typeof raw === 'string' ? raw.trim() : ''
      if (text) addPosting({ id: crypto.randomUUID(), text })
      // Optimistic updates and DOM calls apply at once inside the action's
      // transition, so the box empties as the comment appears.
      formRef.current?.reset()
      const result = await addCommentAction(boardId, taskId, previous, formData)
      const id = result.status === 'success' ? result.id : undefined
      // Set in the same transition, so it takes over from the optimistic
      // copy without a flicker.
      if (id && text) setPosted((current) => [{ id, text }, ...current])
      return result
    },
    IDLE
  )
  const pending = posting.filter((comment) => !commentIds.includes(comment.id))
  const error = state.status === 'error' ? state.error : undefined
  const values = state.status === 'error' ? state.values : {}

  return (
    <>
      <form
        ref={formRef}
        action={action}
        className='flex flex-col gap-2'
        noValidate
      >
        <FormAlert error={error && !error.fields ? error : undefined} />
        <TextareaField
          id={`task-${taskId}-comment`}
          name='text'
          label='Comment'
          rows={3}
          maxLength={2000}
          defaultValue={values.text ?? ''}
          error={error?.fields?.text}
        />
        <SubmitButton className='self-end' variant='outline'>
          Post comment
        </SubmitButton>
      </form>
      {/* Activity isn't a live region, so this says the post worked (§10). */}
      <p role='status' className='sr-only'>
        {state.status === 'success' ? 'Comment posted' : ''}
      </p>
      {pending.length > 0 || hasEntries ? (
        <ol className='flex flex-col gap-3'>
          {pending.map((comment) => (
            <li key={comment.id} className='flex flex-col gap-1 text-sm'>
              <p>
                <span className='font-medium'>{authorName}</span> commented
              </p>
              <p className='break-words whitespace-pre-line'>{comment.text}</p>
              <p className='text-muted-foreground'>Posting…</p>
            </li>
          ))}
          {children}
        </ol>
      ) : (
        <p className='text-sm text-muted-foreground'>No activity yet.</p>
      )}
    </>
  )
}
// #endregion optimistic-comment
