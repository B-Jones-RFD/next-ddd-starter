import { Suspense } from 'react'

import { TaskActivity } from '@/app/boards/[boardId]/tasks/[taskId]/task-activity'
import {
  TaskDescriptionForm,
  TaskTitleForm,
} from '@/app/boards/[boardId]/tasks/[taskId]/task-forms'
import type { TaskDto } from '@/modules/boards/api'

/**
 * The task's body, shared by its dialog and its page, under the heading
 * each gives it: where it sits, its title and description forms, then its
 * Activity in its own `<Suspense>`.
 */
export function TaskDetails({
  task,
  formKey,
  searchParams,
}: {
  task: TaskDto
  /** Keys the forms, so a sign-out never leaves half-typed text. */
  formKey: string
  /** The route's query, which pages the Activity. */
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  return (
    <div className='flex flex-col gap-6'>
      <p className='text-sm text-muted-foreground'>
        {task.boardName} · in {task.listName}
      </p>
      <TaskTitleForm
        key={`${formKey}-title`}
        boardId={task.boardId}
        task={task}
      />
      <TaskDescriptionForm
        key={`${formKey}-description`}
        boardId={task.boardId}
        task={task}
      />
      <Suspense
        fallback={
          <p className='text-sm text-muted-foreground'>Loading activity…</p>
        }
      >
        <TaskActivity
          boardId={task.boardId}
          taskId={task.id}
          searchParams={searchParams}
        />
      </Suspense>
    </div>
  )
}
