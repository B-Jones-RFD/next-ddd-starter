'use server'

import { refresh } from 'next/cache'
import { redirect } from 'next/navigation'

import { formValues, type ActionState } from '@/app/_lib/actions/action-state'
import { getActor } from '@/app/_lib/auth/get-actor'
import { signInPath } from '@/app/_lib/auth/next-path'
import { toActionError } from '@/app/_lib/errors/to-action-error'
import { archiveBoard, renameBoard, restoreBoard } from '@/modules/boards/api'

/**
 * Renames the board, then re-renders the page. `boardId` is bound by the
 * form and untrusted: the domain checks the actor is its Owner.
 */
export async function renameBoardAction(
  boardId: string,
  _previous: ActionState,
  formData: FormData
): Promise<ActionState> {
  const actor = await getActor()
  if (!actor.ok) redirect(signInPath(`/boards/${boardId}/settings`))
  const values = formValues(formData, ['name'])

  try {
    const result = await renameBoard({
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

/**
 * Archives the board once the Owner has typed its name, then goes to the
 * boards grid, which it has left. `boardId` is bound by the form and
 * untrusted: the domain checks the actor is its Owner and the name matches.
 */
export async function archiveBoardAction(
  boardId: string,
  _previous: ActionState,
  formData: FormData
): Promise<ActionState> {
  const actor = await getActor()
  if (!actor.ok) redirect(signInPath(`/boards/${boardId}/settings`))
  const values = formValues(formData, ['confirmName'])

  try {
    const result = await archiveBoard({
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
  redirect('/boards')
}

/** Restores the archived board, then re-renders the page. */
export async function restoreBoardAction(
  boardId: string
): Promise<ActionState> {
  const actor = await getActor()
  if (!actor.ok) redirect(signInPath(`/boards/${boardId}/settings`))

  try {
    const result = await restoreBoard({ actorId: actor.value.userId, boardId })
    if (!result.ok) {
      return { status: 'error', error: toActionError(result.error), values: {} }
    }
  } catch (error) {
    return { status: 'error', error: toActionError(error), values: {} }
  }
  refresh()
  return { status: 'success' }
}
