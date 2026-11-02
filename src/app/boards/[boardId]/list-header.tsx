'use client'

import {
  Archive,
  ArchiveRestore,
  ArrowLeft,
  ArrowRight,
  ChevronsLeft,
  ChevronsRight,
  Ellipsis,
  Pencil,
} from 'lucide-react'
import { useActionState, useCallback, useId, useRef, useState } from 'react'

import { ArchivedBadge } from '@/app/_components/archived-badge'
import { Field } from '@/app/_components/form/field'
import { FormAlert } from '@/app/_components/form/form-alert'
import { SubmitButton } from '@/app/_components/form/submit-button'
import { useRefocus } from '@/app/_components/refocus'
import { Button } from '@/app/_components/ui/button'
import { Dialog, DialogContent, DialogTitle } from '@/app/_components/ui/dialog'
import {
  Menu,
  MenuContent,
  MenuItem,
  MenuSeparator,
  MenuTrigger,
} from '@/app/_components/ui/menu'
import { IDLE, type ActionState } from '@/app/_lib/actions/action-state'
import {
  archiveListAction,
  moveListAction,
  renameListAction,
  restoreListAction,
} from '@/app/boards/[boardId]/actions'
import {
  listHeadingId,
  type BoardMode,
  type ListMove,
  type ListPlace,
} from '@/app/boards/[boardId]/list-places'
import { headingKey } from '@/app/boards/[boardId]/successors'

const MOVES = [
  { move: 'left', label: 'Move left', Icon: ArrowLeft },
  { move: 'right', label: 'Move right', Icon: ArrowRight },
  { move: 'first', label: 'Move first', Icon: ChevronsLeft },
  { move: 'last', label: 'Move last', Icon: ChevronsRight },
] as const satisfies readonly { move: ListMove; label: string; Icon: unknown }[]

type List = { id: string; name: string; archived: boolean }

/**
 * A list column's heading and its "⋯" menu: rename, move left, right, first
 * or last, and archive (§10). Each move is a form, which the menu item
 * submits. After a move, focus returns to this ⋯ in the list's new place,
 * and after an archive, to the next list's. In the Archived view an archived
 * list has a text badge and only "Restore list".
 */
export function ListHeader({
  boardId,
  list,
  mode,
  moves,
  successors,
}: {
  boardId: string
  list: List
  mode: BoardMode
  moves: Partial<Record<ListMove, ListPlace>>
  /** Where focus goes when archiving or restoring takes the list away. */
  successors: string[]
}) {
  const formId = useId()
  const { ref, refocus } = useRefocus(list.id)
  const { ref: headingRef } = useRefocus(headingKey(list.id))
  const trigger = useRef<HTMLButtonElement | null>(null)
  const triggerRef = useCallback(
    (element: HTMLButtonElement | null) => {
      trigger.current = element
      return ref(element)
    },
    [ref]
  )
  const [renaming, setRenaming] = useState(false)
  const [state, move] = useActionState(
    async (previous: ActionState, formData: FormData) => {
      const cancel = refocus()
      const next = await moveListAction(boardId, list.id, previous, formData)
      if (next.status !== 'success') cancel()
      return next
    },
    IDLE
  )
  const [archiveState, archiveOrRestore] = useActionState(async () => {
    const cancel = refocus(...successors)
    const next =
      mode === 'active'
        ? await archiveListAction(boardId, list.id)
        : await restoreListAction(boardId, list.id)
    if (next.status !== 'success') cancel()
    return next
  }, IDLE)
  const editable = mode === 'active'
  const restorable = mode === 'archived' && list.archived
  const available = editable ? MOVES.filter(({ move }) => moves[move]) : []

  return (
    <div className='flex flex-col gap-2'>
      <div className='flex items-start justify-between gap-2'>
        <div className='flex min-w-0 flex-wrap items-center gap-2'>
          {/* Focusable only by script: the jump strip, and refocus after an
              archive, move focus here. */}
          <h2
            ref={headingRef}
            id={listHeadingId(list.id)}
            tabIndex={-1}
            className='min-w-0 rounded-sm px-1 py-1 font-heading font-semibold break-words outline-none focus-visible:ring-3 focus-visible:ring-ring'
          >
            {list.name}
          </h2>
          {list.archived && <ArchivedBadge />}
        </div>
        {(editable || restorable) && (
          <Menu>
            <MenuTrigger
              ref={triggerRef}
              render={<Button variant='ghost' size='icon' />}
              aria-label={`Actions for list ${list.name}`}
            >
              <Ellipsis aria-hidden />
            </MenuTrigger>
            <MenuContent>
              {editable && (
                <MenuItem onClick={() => setRenaming(true)}>
                  <Pencil aria-hidden />
                  Rename list
                </MenuItem>
              )}
              {available.length > 0 && <MenuSeparator />}
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
              {editable && <MenuSeparator />}
              <MenuItem
                nativeButton
                render={<button type='submit' form={`${formId}-archive`} />}
              >
                {editable ? (
                  <>
                    <Archive aria-hidden />
                    Archive list
                  </>
                ) : (
                  <>
                    <ArchiveRestore aria-hidden />
                    Restore list
                  </>
                )}
              </MenuItem>
            </MenuContent>
          </Menu>
        )}
      </div>
      <FormAlert error={state.status === 'error' ? state.error : undefined} />
      <FormAlert
        error={archiveState.status === 'error' ? archiveState.error : undefined}
      />
      <form id={`${formId}-archive`} action={archiveOrRestore} hidden />
      {available.map(({ move: name }) => (
        <form key={name} id={`${formId}-${name}`} action={move} hidden>
          <input type='hidden' name='after' value={moves[name]?.after ?? ''} />
          <input
            type='hidden'
            name='before'
            value={moves[name]?.before ?? ''}
          />
        </form>
      ))}
      <Dialog open={renaming} onOpenChange={setRenaming}>
        <DialogContent finalFocus={trigger}>
          <DialogTitle>Rename list</DialogTitle>
          {/* The popup unmounts on close, so each opening starts fresh. */}
          <RenameListForm
            boardId={boardId}
            list={list}
            onSuccess={() => setRenaming(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  )
}

function RenameListForm({
  boardId,
  list,
  onSuccess,
}: {
  boardId: string
  list: List
  onSuccess: () => void
}) {
  const [state, action] = useActionState(
    async (previous: ActionState, formData: FormData) => {
      const next = await renameListAction(boardId, list.id, previous, formData)
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
        id={`rename-list-${list.id}-name`}
        name='name'
        label='List name'
        autoComplete='off'
        required
        maxLength={60}
        defaultValue={values.name ?? list.name}
        error={error?.fields?.name}
      />
      <SubmitButton className='self-end'>Save list name</SubmitButton>
    </form>
  )
}
