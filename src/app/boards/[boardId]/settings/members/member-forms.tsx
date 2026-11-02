'use client'

import { useActionState, type ReactNode } from 'react'

import { FormAlert } from '@/app/_components/form/form-alert'
import { SubmitButton } from '@/app/_components/form/submit-button'
import { IDLE, type ActionState } from '@/app/_lib/actions/action-state'
import {
  addMemberAction,
  leaveBoardAction,
  removeMemberAction,
  transferOwnershipAction,
} from '@/app/boards/[boardId]/settings/members/actions'

/** The id of the Members heading, where focus goes when its control goes. */
export const MEMBERS_HEADING_ID = 'members-heading'

/**
 * One button in its own form, with its alert. The control that was pressed
 * goes away on success (its row, or the Owner's controls), so focus moves to
 * the Members heading instead of being lost (§10).
 */
function ButtonForm({
  action,
  variant,
  children,
}: {
  action: (previous: ActionState) => Promise<ActionState>
  variant?: 'outline' | 'destructive'
  children: ReactNode
}) {
  const [state, formAction] = useActionState(async (previous: ActionState) => {
    const next = await action(previous)
    if (next.status === 'success') {
      document.getElementById(MEMBERS_HEADING_ID)?.focus()
    }
    return next
  }, IDLE)
  const error = state.status === 'error' ? state.error : undefined

  return (
    <form action={formAction} className='flex flex-col items-end gap-2'>
      <FormAlert error={error} />
      <SubmitButton variant={variant}>{children}</SubmitButton>
    </form>
  )
}

/** Adds the user the Owner found by email. */
export function AddMemberForm({
  boardId,
  userId,
  name,
}: {
  boardId: string
  userId: string
  name: string
}) {
  return (
    <ButtonForm action={addMemberAction.bind(null, boardId, userId)}>
      Add {name}
    </ButtonForm>
  )
}

/** The Owner's controls for one Member: transfer ownership, or remove. */
export function MemberControls({
  boardId,
  userId,
  name,
}: {
  boardId: string
  userId: string
  name: string
}) {
  return (
    <div className='flex flex-wrap justify-end gap-2'>
      <ButtonForm
        action={transferOwnershipAction.bind(null, boardId, userId)}
        variant='outline'
      >
        Transfer ownership<span className='sr-only'> to {name}</span>
      </ButtonForm>
      <ButtonForm
        action={removeMemberAction.bind(null, boardId, userId)}
        variant='destructive'
      >
        Remove<span className='sr-only'> {name}</span>
      </ButtonForm>
    </div>
  )
}

/** A Member leaves the board, and lands on their grid. */
export function LeaveBoardForm({ boardId }: { boardId: string }) {
  return (
    <ButtonForm
      action={leaveBoardAction.bind(null, boardId)}
      variant='destructive'
    >
      Leave board
    </ButtonForm>
  )
}
