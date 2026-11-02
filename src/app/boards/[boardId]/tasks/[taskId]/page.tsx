import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'

import { requireActor } from '@/app/_lib/auth/get-actor'
import { taskPath } from '@/app/boards/[boardId]/task-places'
import { TaskDetails } from '@/app/boards/[boardId]/tasks/[taskId]/task-details'
import { getTask } from '@/modules/boards/api'

export const metadata: Metadata = { title: 'Task' }

/** A task's own page, for a direct load or a shared link. */
export default function TaskPage({
  params,
  searchParams,
}: PageProps<'/boards/[boardId]/tasks/[taskId]'>) {
  return (
    <Suspense
      fallback={
        <p role='status' className='text-muted-foreground'>
          Loading the task…
        </p>
      }
    >
      <Task params={params} searchParams={searchParams} />
    </Suspense>
  )
}

async function Task({
  params,
  searchParams,
}: PageProps<'/boards/[boardId]/tasks/[taskId]'>) {
  const { boardId, taskId } = await params
  const actor = await requireActor(taskPath(boardId, taskId))
  const task = await getTask({ actorId: actor.userId, taskId })
  // A task the actor can't see, or on another board, doesn't exist (§9).
  if (!task.ok || task.value.boardId !== boardId) notFound()

  return (
    <div className='mx-auto flex w-full max-w-2xl flex-col gap-4'>
      <nav aria-label='Board'>
        <Link
          href={`/boards/${boardId}`}
          className='rounded-sm text-sm font-medium text-foreground underline underline-offset-4'
        >
          Back to {task.value.boardName}
        </Link>
      </nav>
      <h1 className='font-heading text-2xl font-semibold break-words'>
        {task.value.title}
      </h1>
      <TaskDetails
        task={task.value}
        formKey={actor.userId}
        searchParams={searchParams}
      />
    </div>
  )
}
