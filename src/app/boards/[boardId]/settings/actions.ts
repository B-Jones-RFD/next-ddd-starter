'use server'

import { refresh } from 'next/cache'
import { redirect } from 'next/navigation'

import { formValues, type ActionState } from '@/app/_lib/actions/action-state'
import { getActor } from '@/app/_lib/auth/get-actor'
import { signInPath } from '@/app/_lib/auth/next-path'
import { toActionError } from '@/app/_lib/errors/to-action-error'
import { renameBoard } from '@/modules/boards/api'

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
