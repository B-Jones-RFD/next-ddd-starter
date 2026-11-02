'use server'

import { refresh } from 'next/cache'
import { redirect } from 'next/navigation'

import { formValues, type ActionState } from '@/app/_lib/actions/action-state'
import { getActor } from '@/app/_lib/auth/get-actor'
import { signInPath } from '@/app/_lib/auth/next-path'
import { toActionError } from '@/app/_lib/errors/to-action-error'
import { taskPath } from '@/app/boards/[boardId]/task-places'
import {
  addComment,
  changeTaskDescription,
  renameTask,
} from '@/modules/boards/api'

// The task's actions, from its dialog and its page. Bound ids are untrusted:
// the domain checks the actor is a Board member of the task's board.

/** Renames the task, then re-renders it where it is shown. */
export async function renameTaskAction(
  boardId: string,
  taskId: string,
  _previous: ActionState,
  formData: FormData
): Promise<ActionState> {
  const actor = await getActor()
  if (!actor.ok) redirect(signInPath(taskPath(boardId, taskId)))
  const values = formValues(formData, ['title'])

  try {
    const result = await renameTask({
      actorId: actor.value.userId,
      taskId,
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

/** Changes or clears the task's description, then re-renders it. */
export async function changeTaskDescriptionAction(
  boardId: string,
  taskId: string,
  _previous: ActionState,
  formData: FormData
): Promise<ActionState> {
  const actor = await getActor()
  if (!actor.ok) redirect(signInPath(taskPath(boardId, taskId)))
  const values = formValues(formData, ['description'])

  try {
    const result = await changeTaskDescription({
      actorId: actor.value.userId,
      taskId,
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
 * Comments on the task, then re-renders it. Activity picks the comment up
 * one relay drain later, and the form shows it optimistically until then:
 * the action never waits for the relay (§6).
 */
export async function addCommentAction(
  boardId: string,
  taskId: string,
  _previous: ActionState,
  formData: FormData
): Promise<ActionState> {
  const actor = await getActor()
  if (!actor.ok) redirect(signInPath(taskPath(boardId, taskId)))
  const values = formValues(formData, ['text'])

  try {
    const result = await addComment({
      actorId: actor.value.userId,
      taskId,
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
