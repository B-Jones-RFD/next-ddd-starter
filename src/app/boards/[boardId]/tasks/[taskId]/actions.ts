'use server'

import { refresh } from 'next/cache'
import { redirect } from 'next/navigation'

import { formValues, type ActionState } from '@/app/_lib/actions/action-state'
import { getActor } from '@/app/_lib/auth/get-actor'
import { signInPath } from '@/app/_lib/auth/next-path'
import { toActionError } from '@/app/_lib/errors/to-action-error'
import { taskPath } from '@/app/boards/[boardId]/task-places'
import {
  assignTask,
  changeTaskDescription,
  renameTask,
  unassignTask,
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

/** Makes the chosen Board member an assignee, then re-renders the task. */
export async function assignTaskAction(
  boardId: string,
  taskId: string,
  _previous: ActionState,
  formData: FormData
): Promise<ActionState> {
  const actor = await getActor()
  if (!actor.ok) redirect(signInPath(taskPath(boardId, taskId)))
  const values = formValues(formData, ['userId'])

  try {
    const result = await assignTask({
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

/** Unassigns the bound assignee, then re-renders the task. */
export async function unassignTaskAction(
  boardId: string,
  taskId: string,
  userId: string
): Promise<ActionState> {
  const actor = await getActor()
  if (!actor.ok) redirect(signInPath(taskPath(boardId, taskId)))

  try {
    const result = await unassignTask({
      actorId: actor.value.userId,
      taskId,
      userId,
    })
    if (!result.ok) {
      return { status: 'error', error: toActionError(result.error), values: {} }
    }
  } catch (error) {
    return { status: 'error', error: toActionError(error), values: {} }
  }
  refresh()
  return { status: 'success' }
}
