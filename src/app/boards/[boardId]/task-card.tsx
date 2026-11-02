'use client'

import {
  ArrowDown,
  ArrowRightLeft,
  ArrowUp,
  ChevronsDown,
  ChevronsUp,
  Ellipsis,
} from 'lucide-react'
import Link from 'next/link'
import { useActionState, useCallback, useId, useRef, useState } from 'react'

import { FormAlert } from '@/app/_components/form/form-alert'
import { SubmitButton } from '@/app/_components/form/submit-button'
import { useRefocus } from '@/app/_components/refocus'
import { TagBadge } from '@/app/_components/tags/tag-badge'
import type { TagColorName } from '@/app/_components/tags/tag-colors'
import { Button } from '@/app/_components/ui/button'
import { Dialog, DialogContent, DialogTitle } from '@/app/_components/ui/dialog'
import { Label } from '@/app/_components/ui/label'
import {
  Menu,
  MenuContent,
  MenuItem,
  MenuSeparator,
  MenuTrigger,
} from '@/app/_components/ui/menu'
import { Select } from '@/app/_components/ui/select'
import { IDLE, type ActionState } from '@/app/_lib/actions/action-state'
import {
  moveTaskAction,
  reorderTaskAction,
} from '@/app/boards/[boardId]/actions'
import type { ListMove, ListPlace } from '@/app/boards/[boardId]/list-places'
import {
  placesIn,
  taskLinkId,
  taskPath,
} from '@/app/boards/[boardId]/task-places'

// A list's order runs top to bottom, so its previous and next places
// (`left` and `right` in `movesFor`) are up and down.
const MOVES = [
  { move: 'left', label: 'Move up', Icon: ArrowUp },
  { move: 'right', label: 'Move down', Icon: ArrowDown },
  { move: 'first', label: 'Move first', Icon: ChevronsUp },
  { move: 'last', label: 'Move last', Icon: ChevronsDown },
] as const satisfies readonly { move: ListMove; label: string; Icon: unknown }[]

type Task = {
  id: string
  title: string
  tags: { id: string; name: string; color: TagColorName }[]
}
type List = { id: string; name: string; tasks: Task[] }

/** The task's own place in its list, or the bottom of another. */
function initial(choices: readonly { current: boolean }[]): number {
  const current = choices.findIndex((choice) => choice.current)
  return current === -1 ? choices.length - 1 : current
}

/**
 * A task in its list's column: its title as an `h3` link that opens the task
 * dialog, and its "⋯" menu to move it up, down, first or last, or to another
 * list (§10). After a move, focus returns to this ⋯ in the task's new place.
 */
export function TaskCard({
  boardId,
  listId,
  task,
  moves,
  lists,
}: {
  boardId: string
  listId: string
  task: Task
  moves: Partial<Record<ListMove, ListPlace>>
  /** The board's lists, for "Move to list…". */
  lists: List[]
}) {
  const formId = useId()
  const { ref, refocus } = useRefocus(task.id)
  const trigger = useRef<HTMLButtonElement | null>(null)
  const triggerRef = useCallback(
    (element: HTMLButtonElement | null) => {
      trigger.current = element
      return ref(element)
    },
    [ref]
  )
  const [moving, setMoving] = useState(false)
  const [state, reorder] = useActionState(
    async (previous: ActionState, formData: FormData) => {
      const cancel = refocus()
      const next = await reorderTaskAction(boardId, task.id, previous, formData)
      if (next.status !== 'success') cancel()
      return next
    },
    IDLE
  )
  const available = MOVES.filter(({ move }) => moves[move])

  return (
    <li className='flex flex-col gap-2 rounded-lg border border-border bg-background p-2'>
      <div className='flex items-start justify-between gap-2'>
        <h3 className='min-w-0 py-1 text-sm font-medium break-words'>
          <Link
            id={taskLinkId(task.id)}
            href={taskPath(boardId, task.id)}
            scroll={false}
            className='rounded-sm px-1 underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring'
          >
            {task.title}
          </Link>
        </h3>
        <Menu>
          <MenuTrigger
            ref={triggerRef}
            render={<Button variant='ghost' size='icon-sm' />}
            aria-label={`Actions for task ${task.title}`}
          >
            <Ellipsis aria-hidden />
          </MenuTrigger>
          <MenuContent>
            {available.map(({ move: name, label, Icon }) => (
              <MenuItem
                key={name}
                nativeButton
                render={<button type='submit' form={`${formId}-${name}`} />}
              >
                <Icon aria-hidden />
                {label}
              </MenuItem>
            ))}
            {available.length > 0 && <MenuSeparator />}
            <MenuItem onClick={() => setMoving(true)}>
              <ArrowRightLeft aria-hidden />
              Move to list…
            </MenuItem>
          </MenuContent>
        </Menu>
      </div>
      {task.tags.length > 0 && (
        <ul aria-label='Tags' className='flex flex-wrap gap-1 px-1'>
          {task.tags.map((tag) => (
            <li key={tag.id} className='max-w-full'>
              <TagBadge tag={tag} />
            </li>
          ))}
        </ul>
      )}
      <FormAlert error={state.status === 'error' ? state.error : undefined} />
      {available.map(({ move: name }) => (
        <form key={name} id={`${formId}-${name}`} action={reorder} hidden>
          <input type='hidden' name='after' value={moves[name]?.after ?? ''} />
          <input
            type='hidden'
            name='before'
            value={moves[name]?.before ?? ''}
          />
        </form>
      ))}
      <Dialog open={moving} onOpenChange={setMoving}>
        <DialogContent finalFocus={trigger}>
          <DialogTitle>Move “{task.title}”</DialogTitle>
          {/* The popup unmounts on close, so each opening starts fresh. */}
          <MoveTaskForm
            boardId={boardId}
            listId={listId}
            task={task}
            lists={lists}
            refocus={refocus}
            onSuccess={() => setMoving(false)}
          />
        </DialogContent>
      </Dialog>
    </li>
  )
}

/**
 * "Move to list…": a List select and a Position select whose choices follow
 * the chosen list. It sends the target list and the ids of the tasks the
 * task will sit between.
 */
function MoveTaskForm({
  boardId,
  listId,
  task,
  lists,
  refocus,
  onSuccess,
}: {
  boardId: string
  listId: string
  task: Task
  lists: List[]
  refocus: () => () => void
  onSuccess: () => void
}) {
  const id = useId()
  const [toListId, setToListId] = useState(listId)
  const places = placesIn(
    lists.find((list) => list.id === toListId)?.tasks ?? [],
    task.id
  )
  const [position, setPosition] = useState(() => initial(places))
  const place = places[position] ?? places.at(-1)

  const [state, action] = useActionState(
    async (previous: ActionState, formData: FormData) => {
      const cancel = refocus()
      const next = await moveTaskAction(boardId, task.id, previous, formData)
      if (next.status === 'success') onSuccess()
      else cancel()
      return next
    },
    IDLE
  )
  const error = state.status === 'error' ? state.error : undefined

  return (
    <form action={action} className='flex flex-col gap-4' noValidate>
      <FormAlert error={error} />
      <div className='flex flex-col gap-1.5'>
        <Label htmlFor={`${id}-list`}>List</Label>
        <Select
          id={`${id}-list`}
          name='toListId'
          value={toListId}
          onChange={(event) => {
            const next = event.target.value
            setToListId(next)
            setPosition(
              initial(
                placesIn(
                  lists.find((list) => list.id === next)?.tasks ?? [],
                  task.id
                )
              )
            )
          }}
        >
          {lists.map((list) => (
            <option key={list.id} value={list.id}>
              {list.id === listId ? `${list.name} (current)` : list.name}
            </option>
          ))}
        </Select>
      </div>
      <div className='flex flex-col gap-1.5'>
        <Label htmlFor={`${id}-position`}>Position</Label>
        <Select
          id={`${id}-position`}
          value={position}
          onChange={(event) => setPosition(Number(event.target.value))}
        >
          {places.map((choice, index) => (
            <option key={index} value={index}>
              {choice.current ? `${choice.label} (current)` : choice.label}
            </option>
          ))}
        </Select>
      </div>
      <input type='hidden' name='after' value={place?.after ?? ''} />
      <input type='hidden' name='before' value={place?.before ?? ''} />
      <SubmitButton className='self-end'>Move task</SubmitButton>
    </form>
  )
}
