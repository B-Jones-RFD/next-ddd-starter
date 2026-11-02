'use server'

import { refresh } from 'next/cache'
import { redirect } from 'next/navigation'

import { formValues, type ActionState } from '@/app/_lib/actions/action-state'
import { getActor } from '@/app/_lib/auth/get-actor'
import { signInPath } from '@/app/_lib/auth/next-path'
import { toActionError } from '@/app/_lib/errors/to-action-error'
import { createList, moveList, renameList } from '@/modules/boards/api'

// The board's actions. Bound ids are untrusted: the domain checks the actor
// is a Board member of the list's board.

/** Adds a list to the end of the board, then re-renders it. */
export async function createListAction(
  boardId: string,
  _previous: ActionState,
  formData: FormData
): Promise<ActionState> {
  const actor = await getActor()
  if (!actor.ok) redirect(signInPath(`/boards/${boardId}`))
  const values = formValues(formData, ['name'])

  try {
    const result = await createList({
      actorId: actor.value.userId,
      boardId,
      ...values,
    })
    if (!result.ok) {
      return { status: 'error', error: toActionError(result.error), values }
    }
  } catch (error) {
    return { status: 'error', error: toActionError(error), values }
  }
  refresh()
  return { status: 'success' }
}

/** Renames a list, then re-renders the board. */
export async function renameListAction(
  boardId: string,
  listId: string,
  _previous: ActionState,
  formData: FormData
): Promise<ActionState> {
  const actor = await getActor()
  if (!actor.ok) redirect(signInPath(`/boards/${boardId}`))
  const values = formValues(formData, ['name'])

  try {
    const result = await renameList({
      actorId: actor.value.userId,
      listId,
      ...values,
    })
    if (!result.ok) {
      return { status: 'error', error: toActionError(result.error), values }
    }
  } catch (error) {
    return { status: 'error', error: toActionError(error), values }
  }
  refresh()
  return { status: 'success' }
}

/**
 * Moves a list between the lists named by the `after` and `before` fields
 * (either may be empty, to move it first or last), then re-renders the board.
 */
export async function moveListAction(
  boardId: string,
  listId: string,
  _previous: ActionState,
  formData: FormData
): Promise<ActionState> {
  const actor = await getActor()
  if (!actor.ok) redirect(signInPath(`/boards/${boardId}`))
  const values = formValues(formData, ['after', 'before'])

  try {
    const result = await moveList({
      actorId: actor.value.userId,
      listId,
      after: values.after || undefined,
      before: values.before || undefined,
    })
    if (!result.ok) {
      return { status: 'error', error: toActionError(result.error), values }
    }
  } catch (error) {
    return { status: 'error', error: toActionError(error), values }
  }
  refresh()
  return { status: 'success' }
}
