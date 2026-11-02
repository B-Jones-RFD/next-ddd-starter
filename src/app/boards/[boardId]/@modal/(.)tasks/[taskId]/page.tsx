import { notFound } from 'next/navigation'
import { Suspense } from 'react'

import { requireActor } from '@/app/_lib/auth/get-actor'
import { taskPath } from '@/app/boards/[boardId]/task-places'
import { TaskDetails } from '@/app/boards/[boardId]/tasks/[taskId]/task-details'
import { TaskDialog } from '@/app/boards/[boardId]/tasks/[taskId]/task-dialog'
import { getTask } from '@/modules/boards/api'

/**
 * A task link followed from the board: the task as a dialog over it. A
 * direct load gets `tasks/[taskId]/page.tsx` instead.
 */
export default function TaskModal({
  params,
}: PageProps<'/boards/[boardId]/tasks/[taskId]'>) {
  // The dialog opens once the task has loaded, so it opens on its heading.
  return (
    <Suspense fallback={null}>
      <Task params={params} />
    </Suspense>
  )
}

async function Task({
  params,
}: Pick<PageProps<'/boards/[boardId]/tasks/[taskId]'>, 'params'>) {
  const { boardId, taskId } = await params
  const actor = await requireActor(taskPath(boardId, taskId))
  const task = await getTask({ actorId: actor.userId, taskId })
  // A task the actor can't see, or on another board, doesn't exist (§9).
  if (!task.ok || task.value.boardId !== boardId) notFound()

  return (
    <TaskDialog boardId={boardId} taskId={taskId} title={task.value.title}>
      <TaskDetails task={task.value} formKey={actor.userId} />
    </TaskDialog>
  )
}
