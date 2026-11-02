import { Suspense } from 'react'

import { ArchivedBadge } from '@/app/_components/archived-badge'
import { TaskActivity } from '@/app/boards/[boardId]/tasks/[taskId]/task-activity'
import {
  TaskDescriptionForm,
  TaskTitleForm,
} from '@/app/boards/[boardId]/tasks/[taskId]/task-forms'
import type { TaskDto } from '@/modules/boards/api'

/**
 * The task's body, shared by its dialog and its page, under the heading
 * each gives it: where it sits, its title and description forms, then its
 * Activity in its own `<Suspense>`. An archived task, or any task on an
 * archived board, is read-only: it shows its description instead of forms.
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
      <div className='flex flex-wrap items-center gap-2'>
        {task.archived && <ArchivedBadge />}
        <p className='text-sm text-muted-foreground'>
          {task.boardName} · in {task.listName}
        </p>
      </div>
      {task.archived || task.boardArchived ? (
        <ReadOnlyTask task={task} />
      ) : (
        <>
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
        </>
      )}
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

/** What an archived task, or a task on an archived board, shows instead. */
function ReadOnlyTask({ task }: { task: TaskDto }) {
  return (
    <>
      <p className='text-sm'>
        {task.archived
          ? 'This task is archived, so it’s read-only. Restore it from the board’s Archived view to change it.'
          : 'This board is archived, so its tasks are read-only.'}
      </p>
      <section aria-labelledby={`task-${task.id}-description-heading`}>
        <h2
          id={`task-${task.id}-description-heading`}
          className='text-sm font-medium'
        >
          Description
        </h2>
        <p className='mt-1.5 text-sm break-words whitespace-pre-wrap text-muted-foreground'>
          {task.description || 'No description.'}
        </p>
      </section>
    </>
  )
}
