'use server'

import { refresh } from 'next/cache'
import { redirect } from 'next/navigation'

import { formValues, type ActionState } from '@/app/_lib/actions/action-state'
import { getActor } from '@/app/_lib/auth/get-actor'
import { signInPath } from '@/app/_lib/auth/next-path'
import { toActionError } from '@/app/_lib/errors/to-action-error'
import {
  createTag,
  deleteTag,
  recolorTag,
  renameTag,
} from '@/modules/boards/api'
import type { ActorDto } from '@/modules/identity/api'

// The Tags tab's actions. Bound ids are untrusted: the domain checks that
// the actor is a Board member and that the tag is on the board.

type Outcome = { ok: true } | { ok: false; error: unknown }

/**
 * Runs tag commands for the signed-in actor as an `ActionState`, stopping at
 * the first that fails, then re-renders the tab.
 */
async function run(
  boardId: string,
  values: Record<string, string>,
  command: (actorId: ActorDto['userId']) => Promise<Outcome>
): Promise<ActionState> {
  const actor = await getActor()
  if (!actor.ok) redirect(signInPath(`/boards/${boardId}/settings/tags`))
  try {
    const result = await command(actor.value.userId)
    if (!result.ok) {
      return { status: 'error', error: toActionError(result.error), values }
    }
  } catch (error) {
    return { status: 'error', error: toActionError(error), values }
  }
  refresh()
  return { status: 'success' }
}

/** Defines a tag with a name and a Tag color. */
export async function createTagAction(
  boardId: string,
  _previous: ActionState,
  formData: FormData
): Promise<ActionState> {
  const values = formValues(formData, ['name', 'color'])
  return run(boardId, values, (actorId) =>
    createTag({ actorId, boardId, ...values })
  )
}

/** Renames and recolors a tag. Either may be unchanged, which saves nothing. */
export async function editTagAction(
  boardId: string,
  tagId: string,
  _previous: ActionState,
  formData: FormData
): Promise<ActionState> {
  const values = formValues(formData, ['name', 'color'])
  return run(boardId, values, async (actorId) => {
    const renamed = await renameTag({
      actorId,
      boardId,
      tagId,
      name: values.name,
    })
    if (!renamed.ok) return renamed
    return recolorTag({ actorId, boardId, tagId, color: values.color })
  })
}

/** Deletes a tag. Its tasks lose it a moment later, as a Consequence. */
export async function deleteTagAction(
  boardId: string,
  tagId: string
): Promise<ActionState> {
  return run(boardId, {}, (actorId) => deleteTag({ actorId, boardId, tagId }))
}
