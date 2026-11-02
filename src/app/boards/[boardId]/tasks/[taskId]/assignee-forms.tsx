'use client'

import { useActionState, useId } from 'react'

import { FormAlert } from '@/app/_components/form/form-alert'
import { SubmitButton } from '@/app/_components/form/submit-button'
import { Label } from '@/app/_components/ui/label'
import { Select } from '@/app/_components/ui/select'
import { IDLE, type ActionState } from '@/app/_lib/actions/action-state'
import { assigneesHeadingId } from '@/app/boards/[boardId]/task-places'
import {
  assignTaskAction,
  unassignTaskAction,
} from '@/app/boards/[boardId]/tasks/[taskId]/actions'

type Person = { userId: string; displayName: string | null }

const UNKNOWN = 'Unknown member'

function nameOf(person: Person): string {
  return person.displayName ?? UNKNOWN
}

/**
 * The task's assignees, each with an Unassign button, then a picker of the
 * Board members not yet assigned. Unassigning removes the pressed button, so
 * focus moves to the Assignees heading instead of being lost (§10).
 */
export function AssigneeForms({
  boardId,
  taskId,
  assignees,
  members,
}: {
  boardId: string
  taskId: string
  assignees: Person[]
  /** The board's members, Owner first. */
  members: Person[]
}) {
  const unassigned = members.filter(
    (member) => !assignees.some((a) => a.userId === member.userId)
  )

  return (
    <div className='flex flex-col gap-3'>
      {assignees.length === 0 ? (
        <p className='text-sm text-muted-foreground'>No one is assigned.</p>
      ) : (
        <ul className='flex flex-col gap-2'>
          {assignees.map((assignee) => (
            <li
              key={assignee.userId}
              className='flex items-start justify-between gap-2'
            >
              <span className='py-1.5 text-sm'>{nameOf(assignee)}</span>
              <UnassignForm
                boardId={boardId}
                taskId={taskId}
                assignee={assignee}
              />
            </li>
          ))}
        </ul>
      )}
      {unassigned.length > 0 ? (
        <AssignForm boardId={boardId} taskId={taskId} choices={unassigned} />
      ) : (
        <p className='text-sm text-muted-foreground'>
          Every Board member is assigned.
        </p>
      )}
    </div>
  )
}

function UnassignForm({
  boardId,
  taskId,
  assignee,
}: {
  boardId: string
  taskId: string
  assignee: Person
}) {
  const [state, action] = useActionState(async (): Promise<ActionState> => {
    const next = await unassignTaskAction(boardId, taskId, assignee.userId)
    if (next.status === 'success') {
      document.getElementById(assigneesHeadingId(taskId))?.focus()
    }
    return next
  }, IDLE)
  const error = state.status === 'error' ? state.error : undefined

  return (
    <form action={action} className='flex flex-col items-end gap-2'>
      <FormAlert error={error} />
      <SubmitButton variant='outline'>
        Unassign<span className='sr-only'> {nameOf(assignee)}</span>
      </SubmitButton>
    </form>
  )
}

function AssignForm({
  boardId,
  taskId,
  choices,
}: {
  boardId: string
  taskId: string
  choices: Person[]
}) {
  const id = useId()
  const [state, action] = useActionState(
    assignTaskAction.bind(null, boardId, taskId),
    IDLE
  )
  const error = state.status === 'error' ? state.error : undefined
  const chosen = state.status === 'error' ? state.values.userId : undefined

  return (
    <form action={action} className='flex flex-col gap-2' noValidate>
      <FormAlert error={error} />
      <div className='flex items-end gap-2'>
        <div className='flex min-w-0 flex-1 flex-col gap-1.5'>
          <Label htmlFor={`${id}-assignee`}>Board member</Label>
          <Select
            id={`${id}-assignee`}
            name='userId'
            // Remounts with what was chosen when an error comes back.
            key={chosen}
            defaultValue={
              choices.some((c) => c.userId === chosen) ? chosen : undefined
            }
          >
            {choices.map((choice) => (
              <option key={choice.userId} value={choice.userId}>
                {nameOf(choice)}
              </option>
            ))}
          </Select>
        </div>
        <SubmitButton variant='outline'>Assign</SubmitButton>
      </div>
    </form>
  )
}
