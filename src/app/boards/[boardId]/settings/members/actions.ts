'use server'

import { refresh } from 'next/cache'
import { redirect } from 'next/navigation'

import type { ActionState } from '@/app/_lib/actions/action-state'
import { getActor } from '@/app/_lib/auth/get-actor'
import { signInPath } from '@/app/_lib/auth/next-path'
import { toActionError } from '@/app/_lib/errors/to-action-error'
import {
  addMember,
  leaveBoard,
  removeMember,
  transferOwnership,
} from '@/modules/boards/api'
import type { ActorDto } from '@/modules/identity/api'

// Every id here is bound by a form and untrusted: the domain checks that the
// actor is the board's Owner (or, to leave, a Member) again.

type Outcome = { ok: true } | { ok: false; error: unknown }

/** Runs a membership command for the signed-in actor as an `ActionState`. */
async function run(
  boardId: string,
  command: (actorId: ActorDto['userId']) => Promise<Outcome>
): Promise<ActionState> {
  const actor = await getActor()
  if (!actor.ok) redirect(signInPath(`/boards/${boardId}/settings/members`))
  try {
    const result = await command(actor.value.userId)
    if (!result.ok) {
      return { status: 'error', error: toActionError(result.error), values: {} }
    }
  } catch (error) {
    return { status: 'error', error: toActionError(error), values: {} }
  }
  return { status: 'success' }
}

/** Adds the user found by the search as a Member, then re-renders the tab. */
export async function addMemberAction(
  boardId: string,
  userId: string
): Promise<ActionState> {
  const state = await run(boardId, (actorId) =>
    addMember({ actorId, boardId, userId })
  )
  if (state.status === 'success') refresh()
  return state
}

/** Removes a Member, then re-renders the tab. */
export async function removeMemberAction(
  boardId: string,
  userId: string
): Promise<ActionState> {
  const state = await run(boardId, (actorId) =>
    removeMember({ actorId, boardId, userId })
  )
  if (state.status === 'success') refresh()
  return state
}

/** Makes another Board member the Owner, then re-renders the tab. */
export async function transferOwnershipAction(
  boardId: string,
  userId: string
): Promise<ActionState> {
  const state = await run(boardId, (actorId) =>
    transferOwnership({ actorId, boardId, userId })
  )
  if (state.status === 'success') refresh()
  return state
}

/** Leaves the board, then goes to the grid, where it no longer appears. */
export async function leaveBoardAction(boardId: string): Promise<ActionState> {
  const state = await run(boardId, (actorId) =>
    leaveBoard({ actorId, boardId })
  )
  if (state.status === 'success') redirect('/boards')
  return state
}
