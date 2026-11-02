'use server'

import { refresh } from 'next/cache'
import { redirect } from 'next/navigation'

import { formValues, type ActionState } from '@/app/_lib/actions/action-state'
import { getActor } from '@/app/_lib/auth/get-actor'
import { signInPath } from '@/app/_lib/auth/next-path'
import { toActionError } from '@/app/_lib/errors/to-action-error'
import {
  archiveList,
  archiveTask,
  createList,
  createTask,
  moveList,
  moveTask,
  renameList,
  reorderTask,
  restoreList,
  restoreTask,
} from '@/modules/boards/api'
import type { ActorDto } from '@/modules/identity/api'

// The board's actions. Bound ids are untrusted: the domain checks the actor
// is a Board member of the list's or task's board.

// #region create-list-action
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
// #endregion create-list-action

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

/** Adds a task to the end of a list, then re-renders the board. */
export async function createTaskAction(
  boardId: string,
  listId: string,
  _previous: ActionState,
  formData: FormData
): Promise<ActionState> {
  const actor = await getActor()
  if (!actor.ok) redirect(signInPath(`/boards/${boardId}`))
  const values = formValues(formData, ['title'])

  try {
    const result = await createTask({
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
 * Moves a task within its list, between the tasks named by the `after` and
 * `before` fields (either may be empty, to move it first or last), then
 * re-renders the board.
 */
export async function reorderTaskAction(
  boardId: string,
  taskId: string,
  _previous: ActionState,
  formData: FormData
): Promise<ActionState> {
  const actor = await getActor()
  if (!actor.ok) redirect(signInPath(`/boards/${boardId}`))
  const values = formValues(formData, ['after', 'before'])

  try {
    const result = await reorderTask({
      actorId: actor.value.userId,
      taskId,
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

/**
 * Moves a task to the list in the `toListId` field, between the tasks named
 * by the `after` and `before` fields ("Move to list…"), then re-renders the
 * board.
 */
export async function moveTaskAction(
  boardId: string,
  taskId: string,
  _previous: ActionState,
  formData: FormData
): Promise<ActionState> {
  const actor = await getActor()
  if (!actor.ok) redirect(signInPath(`/boards/${boardId}`))
  const values = formValues(formData, ['toListId', 'after', 'before'])

  try {
    const result = await moveTask({
      actorId: actor.value.userId,
      taskId,
      toListId: values.toListId,
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

type Outcome = { ok: true } | { ok: false; error: unknown }

/**
 * Runs an archive or restore for the signed-in actor, from a ⋯ menu's
 * bound-id form, then re-renders the board in whichever view it is in.
 */
async function archiving(
  boardId: string,
  command: (actorId: ActorDto['userId']) => Promise<Outcome>
): Promise<ActionState> {
  const actor = await getActor()
  if (!actor.ok) redirect(signInPath(`/boards/${boardId}`))
  try {
    const result = await command(actor.value.userId)
    if (!result.ok) {
      return { status: 'error', error: toActionError(result.error), values: {} }
    }
  } catch (error) {
    return { status: 'error', error: toActionError(error), values: {} }
  }
  refresh()
  return { status: 'success' }
}

/** Archives a list with no active tasks. */
export async function archiveListAction(
  boardId: string,
  listId: string
): Promise<ActionState> {
  return archiving(boardId, (actorId) => archiveList({ actorId, listId }))
}

/** Restores an archived list to its old place. */
export async function restoreListAction(
  boardId: string,
  listId: string
): Promise<ActionState> {
  return archiving(boardId, (actorId) => restoreList({ actorId, listId }))
}

/** Archives a task, which keeps its place. */
export async function archiveTaskAction(
  boardId: string,
  taskId: string
): Promise<ActionState> {
  return archiving(boardId, (actorId) => archiveTask({ actorId, taskId }))
}

/** Restores an archived task to its old place, if its list is active. */
export async function restoreTaskAction(
  boardId: string,
  taskId: string
): Promise<ActionState> {
  return archiving(boardId, (actorId) => restoreTask({ actorId, taskId }))
}
